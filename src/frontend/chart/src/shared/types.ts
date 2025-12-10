import { z } from 'zod';
import { Time } from 'lightweight-charts';

export const TIME_UNITS = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'] as const;
export type TimeUnit = typeof TIME_UNITS[number];

export const timeframeSchema = z.object({
    size: z.number().int().positive(),
    unit: z.enum(TIME_UNITS),
});

export const ohlcParamsSchema = z.object({
    symbol: z.string(),
    timeframeSize: z.number(),
    timeframeUnit: z.enum(TIME_UNITS),
});

export type Timeframe = z.infer<typeof timeframeSchema>;
export type OHLCParams = z.infer<typeof ohlcParamsSchema>;

export interface CandlestickData {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface SymbolDataMessage {
    symbol: string;
    timeframe: Timeframe;
    ohlc: CandlestickData;
}

export interface Bar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    vbuy?: number;
    vsell?: number;
}

const TIMEFRAME_MULTIPLIERS: Record<TimeUnit, number> = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
    week: 604800,
    month: 2592000,
    year: 31536000,
};

export function getTimeframeInSeconds(tf: Timeframe): number {
    return tf.size * (TIMEFRAME_MULTIPLIERS[tf.unit] || 0);
}
