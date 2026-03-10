type DoubleRangeSliderProps = {
  min: number;
  max: number;
  step?: number;
  minValue: number;
  maxValue: number;
  onChange: (nextMin: number, nextMax: number) => void;
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function DoubleRangeSlider({
  min,
  max,
  step = 1,
  minValue,
  maxValue,
  onChange,
  className = "",
}: DoubleRangeSliderProps) {
  const safeMin = clamp(minValue, min, max);
  const safeMax = clamp(maxValue, min, max);
  const leftPct = ((safeMin - min) / (max - min || 1)) * 100;
  const rightPct = ((safeMax - min) / (max - min || 1)) * 100;

  return (
    <div className={className}>
      <div className="relative h-7">
        <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded bg-muted" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded bg-primary/70"
          style={{
            left: `${leftPct}%`,
            width: `${Math.max(0, rightPct - leftPct)}%`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeMin}
          onChange={(e) => {
            const nextMin = clamp(Number(e.target.value), min, safeMax);
            onChange(nextMin, safeMax);
          }}
          className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-background [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-border [&::-moz-range-thumb]:bg-background"
          aria-label="Minimum amount"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeMax}
          onChange={(e) => {
            const nextMax = clamp(Number(e.target.value), safeMin, max);
            onChange(safeMin, nextMax);
          }}
          className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-background [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-border [&::-moz-range-thumb]:bg-background"
          aria-label="Maximum amount"
        />
      </div>
    </div>
  );
}
