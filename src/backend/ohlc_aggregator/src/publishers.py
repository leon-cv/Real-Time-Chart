import asyncio
from json import dumps
import logging
from typing import List

from pulsar import Producer

from src.models import OHLC
from src.time_window import TimeWindow

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class WebsocketPublisher():
    def __init__(self, websocket_producer: Producer, timeframes: List[TimeWindow]):
        self.producer = websocket_producer
        self.timeframes = timeframes

    async def publish(self, symbol: str, timeframe: TimeWindow, ohlc: OHLC) -> None:
        if timeframe in self.timeframes:
            message = {
                'symbol': symbol,
                'timeframe': {'size': timeframe.size, 'unit': timeframe.unit.value},
                'ohlc': ohlc.model_dump()
            }
            await asyncio.to_thread(
                self.producer.send,
                dumps(message).encode('utf-8')
            )
            # logger.debug(f"Published OHLC for {symbol} {timeframe.size} {timeframe.unit.value} to Websocket")


class ClickhousePublisher():
    def __init__(self, clickhouse_client, timeframes: List[TimeWindow]):
        self.client = clickhouse_client
        self.timeframes = timeframes

    async def publish(self, symbol: str, timeframe: TimeWindow, ohlc: OHLC) -> None:
        if timeframe in self.timeframes:
            data = {
                'symbol': symbol,
                'timeframe_size': timeframe.size,
                'timeframe_unit': timeframe.unit.value,
                **ohlc.model_dump()
            }
            await self.client.insert(
                table='ohlc_db.ohlc_table',
                data=[list(data.values())],
                column_names=list(data.keys())
            )
            # logger.debug(f"Published OHLC for {symbol} {timeframe.size} {timeframe.unit.value} to ClickHouse")
