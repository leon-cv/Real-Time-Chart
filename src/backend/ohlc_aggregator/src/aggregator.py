from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import DefaultDict, Dict, List, Tuple

from src.models import Trade, OHLC
from src.time_window import TimeWindow


@dataclass
class _WindowState:
    start: datetime | None = None
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None


class OHLCAggregator:
    def __init__(self, timeframes: List[TimeWindow], smooth_gaps: bool = False):
        self.timeframes = timeframes
        self.smooth_gaps = smooth_gaps
        self._current_windows: DefaultDict[str, Dict[TimeWindow, _WindowState]] = defaultdict(lambda: defaultdict(_WindowState))
        self._last_closes = defaultdict(dict)

    def add_trade(self, trade: Trade) -> List[Tuple[TimeWindow, OHLC]]:
        ohlc_list = []
        symbol = trade.symbol

        for timeframe in self.timeframes:
            window_start = timeframe.get_window_start(trade.timestamp)
            state = self._current_windows[symbol][timeframe]

            if state.start == window_start:
                state.high = max(state.high, trade.price)
                state.low = min(state.low, trade.price)
                state.close = trade.price
            else:
                if state.start is not None and timeframe.is_window_complete(state.start, trade.timestamp):
                    ohlc = OHLC(
                        time=state.start,
                        open=state.open,
                        high=state.high,
                        low=state.low,
                        close=state.close
                    )
                    ohlc_list.append((timeframe, ohlc))
                    self._last_closes[symbol][timeframe] = state.close

                state.start = window_start

                if self.smooth_gaps and timeframe in self._last_closes.get(symbol, {}):
                    state.open = self._last_closes[symbol][timeframe]
                else:
                    state.open = trade.price

                state.high = trade.price
                state.low = trade.price
                state.close = trade.price

        return ohlc_list

    def get_current_state(self, symbol: str) -> Dict[TimeWindow, OHLC]:
        current_state = {}
        for timeframe in self.timeframes:
            state = self._current_windows[symbol][timeframe]
            if state.start is not None:
                current_state[timeframe] = OHLC(
                    time=state.start,
                    open=state.open,
                    high=state.high,
                    low=state.low,
                    close=state.close
                )
        return current_state

    def cleanup_old_windows(self, max_age: timedelta):
        cutoff = datetime.now() - max_age
        for symbol in list(self._current_windows.keys()):
            for timeframe in list(self._current_windows[symbol].keys()):
                state = self._current_windows[symbol][timeframe]
                if state.start and state.start < cutoff:
                    del self._current_windows[symbol][timeframe]
