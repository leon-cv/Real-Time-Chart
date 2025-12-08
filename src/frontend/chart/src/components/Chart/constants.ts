import { TimeUnit, Timeframe } from '~/shared/types';

export const TIMEFRAMES: Timeframe[] = [
  { unit: 'second', sizes: [1, 5, 10, 15, 30, 45] },
  { unit: 'minute', sizes: [1, 2, 3, 5, 10, 15, 30, 45] },
  { unit: 'hour', sizes: [1, 2, 4, 6, 8, 12] },
  { unit: 'day', sizes: [1, 2, 3] },
  { unit: 'week', sizes: [1, 2] },
  { unit: 'month', sizes: [1, 2, 3, 6] },
  { unit: 'year', sizes: [1, 2, 3, 5] },
].flatMap(({ unit, sizes }) => sizes.map((size) => ({ size, unit: unit as TimeUnit })));

export const AVAILABLE_SYMBOLS = ['AAPL', 'GOOG', 'AMZN', 'TSLA', 'MSFT', 'BTCUSDT'];

export const CHART_CONFIG = {
  height: 500,
  layout: {
    background: { color: '#253248' },
    textColor: '#d1d4dc',
  },
  grid: {
    vertLines: { color: '#334158' },
    horzLines: { color: '#334158' },
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: false,
  },
};

export const CANDLESTICK_CONFIG = {
  upColor: '#4bffb5',
  downColor: '#ff4976',
  borderDownColor: '#ff4976',
  borderUpColor: '#4bffb5',
  wickDownColor: '#838ca1',
  wickUpColor: '#838ca1',
};
