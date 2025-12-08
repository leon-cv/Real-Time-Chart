import asyncio
import logging
from typing import Any, List

from pulsar import Message

from src.models import Trade
from src.aggregator import OHLCAggregator

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class OHLCMessageProcessor:
    def __init__(self, aggregator: OHLCAggregator, publishers: List[Any]):
        self.aggregator = aggregator
        self.publishers = publishers

    async def process_message(self, message: Message) -> None:
        try:
            trade = Trade.model_validate_json(message.data())
            ohlc_data = self.aggregator.add_trade(trade)

            for timeframe, ohlc in ohlc_data:
                await asyncio.gather(
                    *(
                        publisher.publish(trade.symbol, timeframe, ohlc)
                        for publisher in self.publishers
                    )
                )
        except Exception as e:
            logger.exception(f"Error processing message: {e}")
            raise
