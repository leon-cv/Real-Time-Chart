import asyncio
import logging

from pulsar import Client, Consumer, ConsumerType, Message, Producer

from src.aggregator import OHLCAggregator
from src.processing import OHLCMessageProcessor
from src.publishers import ClickhousePublisher, WebsocketPublisher
from src.timeframes import TIMEFRAME_CONFIG

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class OHLCMessageService:
    def __init__(
        self,
        pulsar_client: Client,
        clickhouse_client,
        input_topic: str,
        output_topic: str,
        subscription_name: str,
        consumer_type: ConsumerType
    ) -> None:
        self.pulsar_client = pulsar_client
        self.clickhouse_client = clickhouse_client
        self.input_topic = input_topic
        self.output_topic = output_topic
        self.subscription_name = subscription_name
        self.consumer_type = consumer_type
        self.consumer: Consumer | None = None
        self.producer: Producer | None = None
        self.processor: OHLCMessageProcessor | None = None
        self._task: asyncio.Task | None = None
        self._is_running = False

    async def __aenter__(self):
        self.consumer = await asyncio.to_thread(
            self.pulsar_client.subscribe,
            self.input_topic,
            self.subscription_name,
            self.consumer_type
        )

        self.producer = await asyncio.to_thread(
            self.pulsar_client.create_producer,
            self.output_topic
        )

        self.processor = OHLCMessageProcessor(
            OHLCAggregator(timeframes=TIMEFRAME_CONFIG, smooth_gaps=False),
            [
                WebsocketPublisher(self.producer, TIMEFRAME_CONFIG),
                ClickhousePublisher(self.clickhouse_client, TIMEFRAME_CONFIG)
            ]
        )

        self._is_running = True
        self._task = asyncio.create_task(self._message_loop())
        return self

    async def __aexit__(self, *exc):
        logger.debug("Shutting down service...")
        self._is_running = False
        if self._task is not None:
            await self._task
        if self.consumer is not None:
            logger.debug("Closing consumer...")
            await asyncio.to_thread(self.consumer.close)
        if self.producer is not None:
            logger.debug("Closing producer...")
            await asyncio.to_thread(self.producer.close)

    async def _message_loop(self):
        while self._is_running:
            await self._process_next_message()

    async def _process_next_message(self):
        message: Message | None = None
        try:
            message = await asyncio.to_thread(self.consumer.receive)
            await self.processor.process_message(message)
            await asyncio.to_thread(self.consumer.acknowledge, message)
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            if message is not None:
                await asyncio.to_thread(self.consumer.negative_acknowledge, message)
