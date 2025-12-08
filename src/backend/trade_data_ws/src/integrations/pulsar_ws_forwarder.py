import asyncio
import logging

from pulsar import Client, Message, Consumer, ConsumerType

from src.core import ConnectionManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PulsarWebSocketForwarder:
    def __init__(
        self,
        pulsar_client: Client,
        connection_manager: ConnectionManager,
        topic: str,
        subscription_name: str,
        consumer_type: ConsumerType
    ) -> None:
        self.pulsar_client = pulsar_client
        self.connection_manager = connection_manager
        self.topic = topic
        self.subscription_name = subscription_name
        self.consumer_type = consumer_type
        self.consumer: Consumer | None = None
        self._task: asyncio.Task | None = None
        self._is_running = False

    async def __aenter__(self):
        self.consumer = await asyncio.to_thread(
            self.pulsar_client.subscribe,
            self.topic,
            self.subscription_name,
            self.consumer_type
        )
        self._is_running = True
        self._task = asyncio.create_task(self._message_loop())
        return self

    async def __aexit__(self, *exc):
        self._is_running = False
        if self._task is not None:
            await self._task
        if self.consumer is not None:
            await asyncio.to_thread(self.consumer.close)

    async def _message_loop(self):
        while self._is_running:
            await self._process_next_message()

    async def _process_next_message(self):
        message_raw: Message | None = None
        try:
            message_raw = await asyncio.to_thread(self.consumer.receive)
            message_str: str = message_raw.data().decode("utf-8")
            # logger.info(f'Received message: {message_str}')
            await self.connection_manager.broadcast(message_str)
            await asyncio.to_thread(self.consumer.acknowledge, message_raw)
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            if message_raw is not None:
                await asyncio.to_thread(self.consumer.negative_acknowledge, message_raw)
