from json import loads
import logging

from websockets.asyncio.server import ServerConnection
from websockets.exceptions import ConnectionClosed
# from websockets.protocol import State

from src.core import ConnectionManager, Subscription

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def websocket_handler(
    websocket: ServerConnection,
    connection_manager: ConnectionManager
) -> None:
    client_info = f'{websocket.remote_address[0]}:{websocket.remote_address[1]}'

    await connection_manager.connect(websocket)
    current_subscription = None

    try:
        # while websocket.protocol.state == State.OPEN:
        while True:
            message = await websocket.recv()
            data = loads(message)

            new_subscription = Subscription(data)
            if new_subscription != current_subscription:
                if current_subscription:
                    await connection_manager.unsubscribe(websocket, current_subscription, new_subscription)

                current_subscription = new_subscription
                await connection_manager.subscribe(websocket, current_subscription)

    except ConnectionClosed:
        logger.info(f'Connection closed: {client_info}')
    except Exception as e:
        logger.info(f'Error in WebSocket connection: {e}')
    finally:
        if current_subscription:
            await connection_manager.unsubscribe(websocket, current_subscription)
        await connection_manager.disconnect(websocket)
