import React, { Suspense } from 'react';
import { useRealTimeChart } from '~/hooks/useRealTimeChart';
import { ChartControls } from '~/components/ChartControls';
import { ConnectionNotice } from '~/components/ConnectionNotice';

interface ChartProps {
  wsUrl?: string;
}

function ChartInner({ wsUrl = 'ws://localhost:80/ws/' }: ChartProps) {
  const {
    containerRef,
    symbol,
    timeframe,
    setSymbol,
    setTimeframe,
    isConnected,
    isLoading,
    reconnect,
  } = useRealTimeChart({ wsUrl });

  return (
    <>
      <ChartControls
        selectedSymbol={symbol}
        selectedTimeframe={timeframe}
        isLoading={isLoading} // Do I need this if I have Suspense?
        onSymbolChange={setSymbol}
        onTimeframeChange={setTimeframe}
      />

      {!isConnected && <ConnectionNotice onReconnect={reconnect} />}

      <div
        ref={containerRef}
        className="w-full h-[500px] border border-gray-700 rounded"
      />
    </>
  );
}

export const Chart: React.FC<ChartProps> = (props) => (
  <Suspense fallback={<div className="text-blue-500 p-4">Loading chart...</div>}>
    <ChartInner {...props} />
  </Suspense>
);
