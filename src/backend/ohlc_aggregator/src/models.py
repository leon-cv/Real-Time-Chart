from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, Field

# from src.utils import timestamp_to_datetime


class Trade(BaseModel):
    trade_id: str
    trader_id: UUID
    symbol: str
    price: Annotated[float, Field(gt=0)]
    quantity: Annotated[float, Field(gt=0)]
    volume: Annotated[float, Field(gt=0)]
    timestamp: Annotated[
        datetime,
        BeforeValidator(lambda v: datetime.fromtimestamp(v / 1000, tz=timezone.utc))
    ]
    side: str


class OHLC(BaseModel):
    time: Annotated[int, BeforeValidator(lambda v: int(v.timestamp()))]
    open: float
    high: float
    low: float
    close: float
