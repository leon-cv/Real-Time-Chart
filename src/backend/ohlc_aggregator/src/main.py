import asyncio
import logging
from signal import SIGTERM, SIGINT

from clickhouse_connect import get_async_client
from pulsar import ConsumerType, Client

from src.setup import create_table_if_not_exists
from src.service import OHLCMessageService
from src.config import Settings

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

settings = Settings()


async def main():
    pulsar_client = Client(settings.pulsar_service_url)
    clickhouse_client = await get_async_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_port,
        username=settings.clickhouse_username,
        password=settings.clickhouse_password,
        database=settings.clickhouse_db,
    )
    await create_table_if_not_exists(clickhouse_client)

    try:
        async with OHLCMessageService(
            pulsar_client,
            clickhouse_client,
            settings.input_topic,
            settings.output_topic,
            settings.subscription_name,
            ConsumerType.Failover
        ):
            shutdown_event = asyncio.Event()
            loop = asyncio.get_running_loop()
            for sig in (SIGTERM, SIGINT):
                loop.add_signal_handler(sig, shutdown_event.set)
            await shutdown_event.wait()
    finally:
        await asyncio.to_thread(pulsar_client.close)
        logger.info("Pulsar client closed")
        await asyncio.to_thread(clickhouse_client.close)
        logger.info("Clickhouse client closed")


if __name__ == "__main__":
    asyncio.run(main())
