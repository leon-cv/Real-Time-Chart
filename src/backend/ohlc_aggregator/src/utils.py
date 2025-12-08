from datetime import datetime, timezone


def timestamp_to_datetime(v: int) -> datetime:
    """Convert the UTC Unix timestamp (ms) to a datetime object"""
    return datetime.fromtimestamp(v / 1000, tz=timezone.utc)
