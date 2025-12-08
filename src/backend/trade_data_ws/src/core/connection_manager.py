from asyncio import Lock
from collections import defaultdict
from dataclasses import dataclass
from json import loads
import logging
from typing import DefaultDict, Set, Tuple

from websockets.asyncio.server import broadcast as ws_broadcast, ServerConnection
from websockets.typing import Data

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Subscription:
    symbol: str
    timeframe: Tuple[int, str]

    def __init__(self, data: dict):
        symbol = data.get("symbol")
        if not isinstance(symbol, str) or not symbol.strip():
            raise ValueError("Invalid symbol: must be a non-empty string")

        timeframe = data.get("timeframe")
        if not isinstance(data, dict) or 'size' not in timeframe or 'unit' not in timeframe:
            raise ValueError("Invalid timeframe format: Must be a dictionary with 'size' and 'unit' keys")

        size, unit = timeframe["size"], timeframe["unit"]
        if not isinstance(size, int):
            raise ValueError("Invalid timeframe: 'size' must be an integer")
        if not isinstance(unit, str):
            raise ValueError("Invalid timeframe: 'unit' must be a string")

        object.__setattr__(self, 'symbol', symbol)
        object.__setattr__(self, 'timeframe', (size, unit))

    def requires_one_second_updates(self) -> bool:
        return self.timeframe != (1, "second")

    def as_one_second_subscription(self):
        return Subscription({"symbol": self.symbol, "timeframe": {"size": 1, "unit": "second"}})


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[ServerConnection] = set()
        self.subscriptions: DefaultDict[Subscription, Set[ServerConnection]] = defaultdict(set)
        self.lock = Lock()

    async def connect(self, websocket: ServerConnection) -> None:
        async with self.lock:
            self.active_connections.add(websocket)

        client_info = f'{websocket.remote_address[0]}:{websocket.remote_address[1]}'
        logger.info(f'New connection: {client_info}')

    async def disconnect(self, websocket: ServerConnection) -> None:
        async with self.lock:
            self.active_connections.discard(websocket)

        client_info = f'{websocket.remote_address[0]}:{websocket.remote_address[1]}'
        logger.info(f'Removed connection: {client_info}')

    async def subscribe(self, websocket: ServerConnection, subscription: Subscription):
        async with self.lock:
            self.subscriptions[subscription].add(websocket)

            if subscription.requires_one_second_updates():
                one_second_subscription = subscription.as_one_second_subscription()
                if websocket not in self.subscriptions[one_second_subscription]:
                    self.subscriptions[one_second_subscription].add(websocket)

        client_info = f'{websocket.remote_address[0]}:{websocket.remote_address[1]}'
        logger.info(f'{client_info} subscribed to {subscription}')

    async def unsubscribe(self, websocket: ServerConnection, subscription: Subscription, new_subscription: Subscription = None):
        async with self.lock:
            if subscription in self.subscriptions:
                self.subscriptions[subscription].discard(websocket)
                if not self.subscriptions[subscription]:
                    del self.subscriptions[subscription]

            if new_subscription is None or not new_subscription.requires_one_second_updates():
                one_second_subscription = subscription.as_one_second_subscription()
                if one_second_subscription in self.subscriptions:
                    self.subscriptions[one_second_subscription].discard(websocket)
                    if not self.subscriptions[one_second_subscription]:
                        del self.subscriptions[one_second_subscription]

        client_info = f'{websocket.remote_address[0]}:{websocket.remote_address[1]}'
        logger.info(f'{client_info} unsubscribed from {subscription}')

    async def broadcast(self, message: Data) -> None:
        message_dict = loads(message)
        subscription = Subscription(message_dict)

        if subscription in self.subscriptions:
            async with self.lock:
                clients = self.subscriptions[subscription]
                ws_broadcast(clients, message)

            logger.info(f'Broadcasted {subscription} to {len(self.subscriptions[subscription])} client(s)')
        # else:
        #     logger.warning(f'No subscriptions found for {subscription}. Skipping broadcast.')
