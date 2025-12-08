import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import {
    CandlestickData,
    SymbolDataMessage,
    TimeUnit,
    Timeframe,
    getTimeframeInSeconds
} from '~/shared/types';
import { WebSocketService } from '~/services/WebSocketService';
import { CANDLESTICK_CONFIG, CHART_CONFIG } from '~/components/Chart/constants';
import { CandlestickManager } from "~/managers/CandlestickManager";
import { useNavigate, useSearch } from '@tanstack/react-router';
import { fetchChartData, fetchFormingCandle } from '~/server/chart';
import { useSuspenseQuery } from '@tanstack/react-query';

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

export function useRealTimeChart({ wsUrl }: { wsUrl: string }) {
    const search = useSearch({ from: '/' });
    const navigate = useNavigate({ from: '/' });

    const symbol = search.symbol;
    const timeframe = useMemo<Timeframe>(() => ({
        size: search.tf_size,
        unit: search.tf_unit as TimeUnit
    }), [search.tf_size, search.tf_unit]);

    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const historicalSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const formingSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const wsRef = useRef<WebSocketService<SymbolDataMessage> | null>(null);

    const [historicalBars, setHistoricalBars] = useState<Bar[]>([]);
    const [formingBar, setFormingBar] = useState<Bar | null>(null);

    const bootstrapSyncRef = useRef({
        completed: false,
        timeframeKey: ''
    });

    const { data: historicalData } = useSuspenseQuery({
        queryKey: ["ohlc", symbol, timeframe.size, timeframe.unit],
        queryFn: () => fetchChartData({
            symbol,
            timeframeSize: timeframe.size,
            timeframeUnit: timeframe.unit,
        }),
    });

    const manager = useMemo(() => {
        const timeframeSeconds = getTimeframeInSeconds(timeframe);
        return new CandlestickManager(timeframeSeconds);
    }, [timeframe.size, timeframe.unit]);

    const [isConnected, setIsConnected] = useState(false);
    useEffect(() => {
        const interval = setInterval(() => {
            setIsConnected(wsRef.current?.isConnected() ?? false);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: CHART_CONFIG.height,
            layout: CHART_CONFIG.layout,
            grid: CHART_CONFIG.grid,
            timeScale: CHART_CONFIG.timeScale,
        });

        historicalSeriesRef.current = chart.addCandlestickSeries(CANDLESTICK_CONFIG);
        formingSeriesRef.current = chart.addCandlestickSeries(CANDLESTICK_CONFIG);
        chartRef.current = chart;

        const onResize = () => {
            if (!containerRef.current) return;
            chart.applyOptions({ width: containerRef.current.clientWidth });
        };
        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener('resize', onResize);
            chart.remove();
        };
    }, []);

    useEffect(() => {
        const timeframeKey = `${symbol}-${timeframe.size}-${timeframe.unit}`;

        bootstrapSyncRef.current = {
            completed: false,
            timeframeKey
        };

        const bars: Bar[] = Array.isArray(historicalData)
            ? historicalData.map((d: any) => ({
                time: d.time as number,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume ?? 0,
                vbuy: d.vbuy ?? 0,
                vsell: d.vsell ?? 0,
            }))
            : [];

        const normalized = manager.normalizeHistorical(bars);
        setHistoricalBars(normalized);
        setFormingBar(null);

        let cancelled = false;

        (async () => {
            try {
                const res = await fetchFormingCandle({
                    symbol,
                    timeframeSize: timeframe.size,
                    timeframeUnit: timeframe.unit,
                });

                if (cancelled || bootstrapSyncRef.current.timeframeKey !== timeframeKey) return;

                if (res) {
                    const lastClose = normalized[normalized.length - 1]?.close;
                    const bootstrapped = manager.bootstrapForming(res as any, lastClose);

                    setFormingBar(bootstrapped);
                    bootstrapSyncRef.current.completed = true;
                } else {
                    bootstrapSyncRef.current.completed = true;
                }
            } catch (err) {
                console.error("[Hook] Bootstrap error", err);
                bootstrapSyncRef.current.completed = true;
            }
        })();

        return () => { cancelled = true; };
    }, [historicalData, manager, symbol, timeframe.size, timeframe.unit]);

    useEffect(() => {
        if (!historicalSeriesRef.current) return;

        const data: CandlestickData[] = historicalBars.map(bar => ({
            time: normalizeToSeconds(bar.time) as UTCTimestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
        }));

        historicalSeriesRef.current.setData(data);
    }, [historicalBars]);

    useEffect(() => {
        if (!formingSeriesRef.current || !historicalSeriesRef.current) return;

        if (formingBar) {
            formingSeriesRef.current.setData([{
                time: normalizeToSeconds(formingBar.time) as UTCTimestamp,
                open: formingBar.open,
                high: formingBar.high,
                low: formingBar.low,
                close: formingBar.close,
            }]);

            historicalSeriesRef.current.applyOptions({
                priceLineVisible: false,
                lastValueVisible: false,
            });
        } else {
            formingSeriesRef.current.setData([]);
            historicalSeriesRef.current.applyOptions({
                priceLineVisible: true,
                lastValueVisible: true,
            });
        }
    }, [formingBar]);

    useEffect(() => {
        wsRef.current = new WebSocketService(wsUrl, { autoConnect: true });

        let lastUpdate = 0;
        const THROTTLE_MS = 100;

        const unsubscribe = wsRef.current.subscribe((msg) => {
            if (!msg || msg.symbol !== symbol) return;

            const now = Date.now();
            const shouldThrottle = now - lastUpdate < THROTTLE_MS;

            const isOneSecond = msg.timeframe.size === 1 && msg.timeframe.unit === 'second';
            const isCurrentTimeframe =
                msg.timeframe.size === timeframe.size &&
                msg.timeframe.unit === timeframe.unit;

            if (isCurrentTimeframe && !isOneSecond) {
                const completedCandle = msg.ohlc;

                setHistoricalBars(prev => {
                    const updated = manager.mergeCompletedCandle(prev, completedCandle);
                    const lastClose = updated[updated.length - 1]?.close;

                    fetchFormingCandle({
                        symbol,
                        timeframeSize: timeframe.size,
                        timeframeUnit: timeframe.unit,
                    }).then(res => {
                        if (res) {
                            const bootstrapped = manager.bootstrapForming(res as any, lastClose);
                            setFormingBar(bootstrapped);
                        } else {
                            setFormingBar(null);
                        }
                    }).catch(err => {
                        console.error("[Hook] Error fetching new forming candle", err);
                        setFormingBar(null);
                    });

                    return updated;
                });

                lastUpdate = now;
                return;
            }

            if (isOneSecond) {
                if (shouldThrottle) return;

                const trade = {
                    timestamp: Number(msg.ohlc.time),
                    price: msg.ohlc.close,
                };

                if (!bootstrapSyncRef.current.completed) {
                    return;
                }

                setFormingBar(currentForming => {
                    if (currentForming && manager.shouldPromoteForming(currentForming, trade.timestamp)) {
                        setHistoricalBars(prev => {
                            const promoted = manager.mergeCompletedCandle(prev, {
                                time: currentForming.time as UTCTimestamp,
                                open: currentForming.open,
                                high: currentForming.high,
                                low: currentForming.low,
                                close: currentForming.close,
                            });

                            return promoted;
                        });

                        const newForming = manager.updateFormingBar(null, trade, currentForming.close);
                        return newForming;
                    }

                    if (!currentForming) {
                        setHistoricalBars(prev => {
                            const lastClose = prev[prev.length - 1]?.close;
                            setFormingBar(manager.updateFormingBar(null, trade, lastClose));
                            return prev;
                        });
                        return currentForming;
                    }

                    return manager.updateFormingBar(currentForming, trade, undefined);
                });

                lastUpdate = now;
            }
        });

        wsRef.current.send({ symbol, timeframe: { size: 1, unit: 'second' } });
        if (!(timeframe.size === 1 && timeframe.unit === 'second')) {
            wsRef.current.send({ symbol, timeframe });
        }

        return () => {
            unsubscribe();
            wsRef.current?.disconnect();
        };
    }, [wsUrl, symbol, timeframe.size, timeframe.unit, manager]);

    const reconnect = useCallback(async () => {
        await wsRef.current?.connect();
    }, []);

    const setSymbol = useCallback((newSymbol: string) => {
        navigate({ search: (prev) => ({ ...prev, symbol: newSymbol }) });
    }, [navigate]);

    const setTimeframe = useCallback((tf: Timeframe) => {
        navigate({ search: (prev) => ({ ...prev, tf_size: tf.size, tf_unit: tf.unit }) });
    }, [navigate]);

    return {
        containerRef,
        symbol,
        timeframe,
        setSymbol,
        setTimeframe,
        isConnected,
        isLoading: false,
        reconnect,
        formingBar,
        historicalBars,
    };
}