import asyncio
import logging
from os import getenv
from signal import SIGINT, SIGTERM

from pulsar import ConsumerType, Client
from websockets.asyncio.server import serve

from src.core import ConnectionManager
from src.integrations import PulsarWebSocketForwarder
from src.handlers.websocket_handler import websocket_handler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

PULSAR_SERVICE_URL = getenv('PULSAR_SERVICE_URL', 'pulsar://pulsar:6650')
INPUT_TOPIC = getenv('INPUT_TOPIC', 'persistent://public/default/ohlc-trades')
SUBSCRIPTION_NAME = getenv('SUBSCRIPTION_NAME', 'trade-data-ws-consumer')


async def main():
    connection_manager = ConnectionManager()
    pulsar_client = Client(PULSAR_SERVICE_URL)

    try:
        async with PulsarWebSocketForwarder(
            pulsar_client,
            connection_manager,
            INPUT_TOPIC,
            SUBSCRIPTION_NAME,
            ConsumerType.Shared
        ):
            websocket_server = await serve(
                lambda ws: websocket_handler(ws, connection_manager),
                '0.0.0.0',
                8765
            )

            shutdown_event = asyncio.Event()
            loop = asyncio.get_running_loop()
            for sig in (SIGTERM, SIGINT):
                loop.add_signal_handler(sig, shutdown_event.set)

            try:
                await shutdown_event.wait()
            finally:
                logger.info('Closing WebSocket server...')
                websocket_server.close()
                await websocket_server.wait_closed()
                logger.info('WebSocket server closed')
    finally:
        await asyncio.to_thread(pulsar_client.close)
        logger.info('Pulsar client closed')


if __name__ == '__main__':
    asyncio.run(main())
