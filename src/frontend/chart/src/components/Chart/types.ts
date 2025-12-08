export type { CandlestickData, SymbolDataMessage, Timeframe, TimeUnit } from '~/shared/types';
import type { Time } from 'lightweight-charts';

export interface FormingCandleData {
  window_start: Time;
  open: number;
  high: number;
  low: number;
}
