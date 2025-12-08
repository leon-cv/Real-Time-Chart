from datetime import datetime, timedelta
from enum import Enum
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TimeUnit(Enum):
    SECOND = "second"
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


class TimeWindow:
    def __init__(self, size: int, unit: TimeUnit):
        self.size = size
        self.unit = unit

    def __eq__(self, other):
        if isinstance(other, TimeWindow):
            return self.size == other.size and self.unit == other.unit
        return False

    def __hash__(self):
        return hash((self.size, self.unit))

    def get_window_start(self, timestamp: datetime) -> datetime:
        if self.unit == TimeUnit.SECOND:
            total_seconds = timestamp.minute * 60 + timestamp.second
            truncated = (total_seconds // self.size) * self.size
            return timestamp.replace(minute=truncated // 60, second=truncated % 60, microsecond=0)
        elif self.unit == TimeUnit.MINUTE:
            truncated_minute = (timestamp.minute // self.size) * self.size
            return timestamp.replace(minute=truncated_minute, second=0, microsecond=0)
        elif self.unit == TimeUnit.HOUR:
            truncated_hour = (timestamp.hour // self.size) * self.size
            return timestamp.replace(hour=truncated_hour, minute=0, second=0, microsecond=0)
        elif self.unit == TimeUnit.DAY:
            return timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
        elif self.unit == TimeUnit.WEEK:
            return timestamp - timedelta(days=timestamp.weekday())
        elif self.unit == TimeUnit.MONTH:
            return timestamp.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif self.unit == TimeUnit.YEAR:
            return timestamp.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            raise ValueError(f"Unknown time unit: {self.unit}")

    def _window_size(self) -> timedelta:
        if self.unit == TimeUnit.SECOND:
            return timedelta(seconds=self.size)
        elif self.unit == TimeUnit.MINUTE:
            return timedelta(minutes=self.size)
        elif self.unit == TimeUnit.HOUR:
            return timedelta(hours=self.size)
        elif self.unit == TimeUnit.DAY:
            return timedelta(days=self.size)
        elif self.unit == TimeUnit.WEEK:
            return timedelta(weeks=self.size)
        raise ValueError(f"Unsupported time unit for timedelta calculation: {self.unit}")

    def is_window_complete(self, window_start: datetime, current_time: datetime) -> bool:
        """Check if current_time has passed the window end"""
        if self.unit in {TimeUnit.SECOND, TimeUnit.MINUTE, TimeUnit.HOUR, TimeUnit.DAY, TimeUnit.WEEK}:
            window_end = window_start + self._window_size()
        elif self.unit == TimeUnit.MONTH:
            next_month = (window_start.month - 1 + self.size) % 12 + 1
            next_year = window_start.year + (window_start.month - 1 + self.size) // 12
            window_end = window_start.replace(year=next_year, month=next_month, day=1)
        elif self.unit == TimeUnit.YEAR:
            window_end = window_start.replace(year=window_start.year + self.size)
        else:
            raise ValueError(f"Unknown time unit: {self.unit}")

        return current_time >= window_end
