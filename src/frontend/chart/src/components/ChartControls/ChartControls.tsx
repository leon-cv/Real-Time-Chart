import React from 'react';
import { TIMEFRAMES, AVAILABLE_SYMBOLS } from '~/components/Chart/constants';
import { Timeframe, TimeUnit } from '~/shared/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface ChartControlsProps {
  selectedSymbol: string;
  selectedTimeframe: Timeframe;
  isLoading: boolean;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

export const ChartControls: React.FC<ChartControlsProps> = ({
  selectedSymbol,
  selectedTimeframe,
  isLoading,
  onSymbolChange,
  onTimeframeChange
}) => {
  const selectedTfValue = `${selectedTimeframe.size}-${selectedTimeframe.unit}`;

  return (
    <div className="flex items-center gap-4 mb-4">
      <Select
        disabled={isLoading}
        value={selectedSymbol}
        onValueChange={onSymbolChange}
      >
        <SelectTrigger className="w-[160px] bg-gray-900 text-white border-gray-700">
          <SelectValue placeholder="Symbol" />
        </SelectTrigger>
        <SelectContent className="bg-gray-900 text-white border-gray-700">
          {AVAILABLE_SYMBOLS.map((symbol) => (
            <SelectItem key={symbol} value={symbol}>
              {symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        disabled={isLoading}
        value={selectedTfValue}
        onValueChange={(val) => {
          const [size, unit] = val.split("-");
          onTimeframeChange({ size: Number(size), unit: unit as TimeUnit });
        }}
      >
        <SelectTrigger className="w-[160px] bg-gray-900 text-white border-gray-700">
          <SelectValue placeholder="Timeframe" />
        </SelectTrigger>
        <SelectContent className="bg-gray-900 text-white border-gray-700">
          {TIMEFRAMES.map((tf, i) => (
            <SelectItem key={i} value={`${tf.size}-${tf.unit}`}>
              {tf.size} {tf.unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
