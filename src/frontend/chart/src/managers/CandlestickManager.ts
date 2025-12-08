import { CandlestickData } from "~/shared/types";

function normalizeToSeconds(ts: number | string): number {
    const n = typeof ts === "string" ? Number(ts) : ts;
    if (n > 1e12) return Math.floor(n / 1000);
    return Math.floor(n);
}

interface Bar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    vbuy?: number;
    vsell?: number;
}

interface Trade {
    timestamp: number;
    price: number;
}

interface FormingCandleOHL {
    open: number;
    high: number;
    low: number;
    close?: number | null;
    periodStart: number;
}

export class CandlestickManager {
    constructor(private timeframeSeconds: number) { }

    private floorToTimeframe(timestamp: number): number {
        return Math.floor(timestamp / this.timeframeSeconds) * this.timeframeSeconds;
    }

    normalizeHistorical(bars: Bar[]): Bar[] {
        const uniqueMap = new Map<number, Bar>();

        bars.forEach(bar => {
            const time = this.floorToTimeframe(normalizeToSeconds(bar.time));

            if (!uniqueMap.has(time) || bar.time > (uniqueMap.get(time)?.time ?? 0)) {
                uniqueMap.set(time, { ...bar, time });
            }
        });

        return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
    }

    updateFormingBar(
        currentForming: Bar | null,
        trade: Trade,
        lastHistoricalClose?: number
    ): Bar {
        const tsSec = normalizeToSeconds(trade.timestamp);
        const barTime = this.floorToTimeframe(tsSec);

        if (currentForming && currentForming.time === barTime) {
            return {
                ...currentForming,
                high: Math.max(currentForming.high, trade.price),
                low: Math.min(currentForming.low, trade.price),
                close: trade.price,
            };
        }

        const openPrice = lastHistoricalClose ?? trade.price;
        return {
            time: barTime,
            open: openPrice,
            high: Math.max(openPrice, trade.price),
            low: Math.min(openPrice, trade.price),
            close: trade.price,
            volume: 0,
            vbuy: 0,
            vsell: 0,
        };
    }

    mergeCompletedCandle(historical: Bar[], candle: CandlestickData): Bar[] {
        const time = this.floorToTimeframe(candle.time as number);

        const newBar: Bar = {
            time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: 0,
            vbuy: 0,
            vsell: 0,
        };

        const barMap = new Map<number, Bar>();
        historical.forEach(bar => {
            barMap.set(bar.time, bar);
        });
        barMap.set(time, newBar);

        return Array.from(barMap.values()).sort((a, b) => a.time - b.time);
    }

    shouldPromoteForming(formingBar: Bar, newTradeTime: number): boolean {
        if (this.timeframeSeconds !== 1) return false;
        const newBarTime = this.floorToTimeframe(normalizeToSeconds(newTradeTime));
        return formingBar.time !== newBarTime;
    }

    bootstrapForming(
        ohl: FormingCandleOHL,
        lastHistoricalClose?: number
    ): Bar {
        const periodStartSec = this.floorToTimeframe(normalizeToSeconds(ohl.periodStart));
        const close = ohl.close ?? lastHistoricalClose ?? ohl.open;

        return {
            time: periodStartSec,
            open: ohl.open,
            high: ohl.high,
            low: ohl.low,
            close,
            volume: 0,
            vbuy: 0,
            vsell: 0,
        };
    }
}