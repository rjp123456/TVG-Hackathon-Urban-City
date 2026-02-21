"use client";

import { useMemo, useRef, useState } from "react";

type ForecastChartProps = {
  hours: number[];
  loadMW: number[];
  capMW: number[];
  selectedHour: number;
  onHourChange: (hour: number) => void;
  uncertaintyScale?: number;
};

const W = 1200;
const H = 240;
const PAD = { top: 18, right: 20, bottom: 32, left: 48 };

export function ForecastChart({
  hours,
  loadMW,
  capMW,
  selectedHour,
  onHourChange,
  uncertaintyScale = 1,
}: ForecastChartProps) {
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const bounds = useMemo(() => {
    const upper = loadMW.map((v) => v * (1 + 0.06 * uncertaintyScale));
    const lower = loadMW.map((v) => v * (1 - 0.03 * uncertaintyScale));
    const all = [...capMW, ...upper, ...lower];
    return { minY: Math.min(...all) * 0.92, maxY: Math.max(...all) * 1.08 };
  }, [loadMW, capMW, uncertaintyScale]);

  const xScale = (h: number) => PAD.left + (h / 72) * (W - PAD.left - PAD.right);
  const yScale = (v: number) => PAD.top + ((bounds.maxY - v) / (bounds.maxY - bounds.minY)) * (H - PAD.top - PAD.bottom);

  const makePath = (series: number[]) =>
    series
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(hours[i]).toFixed(2)} ${yScale(v).toFixed(2)}`)
      .join(" ");

  const upper = loadMW.map((v) => v * (1 + 0.06 * uncertaintyScale));
  const lower = loadMW.map((v) => v * (1 - 0.03 * uncertaintyScale));

  const bandPath = `${makePath(upper)} ${lower
    .map((v, i) => `L ${xScale(hours[hours.length - 1 - i]).toFixed(2)} ${yScale(v).toFixed(2)}`)
    .join(" ")} Z`;

  const setHourFromClientX = (clientX: number) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onHourChange(Math.round(ratio * 72));
  };

  return (
    <div className="glass-panel p-4" ref={wrapRef}>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <h3 className="uppercase tracking-[0.16em] text-cyan-300">Operational Horizon: 72h</h3>
        <span>Load vs Capacity</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[230px] w-full cursor-crosshair"
        onMouseDown={(e) => {
          setDragging(true);
          setHourFromClientX(e.clientX);
        }}
        onMouseMove={(e) => dragging && setHourFromClientX(e.clientX)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onClick={(e) => setHourFromClientX(e.clientX)}
      >
        {[0, 18, 36, 54, 72].map((tick) => (
          <g key={tick}>
            <line x1={xScale(tick)} y1={PAD.top} x2={xScale(tick)} y2={H - PAD.bottom} className="chart-grid" />
            <text x={xScale(tick)} y={H - 10} textAnchor="middle" className="fill-slate-400 text-[11px]">
              {tick}h
            </text>
          </g>
        ))}

        <path d={bandPath} className="fill-emerald-300/8" />
        <path d={makePath(capMW)} className="chart-capacity" />
        <path d={makePath(loadMW)} className="chart-load" />

        <line x1={xScale(selectedHour)} y1={PAD.top} x2={xScale(selectedHour)} y2={H - PAD.bottom} className="chart-cursor" />
        <circle cx={xScale(selectedHour)} cy={yScale(loadMW[selectedHour])} r={4.5} className="fill-emerald-300" />

        <circle cx={xScale(loadMW.indexOf(Math.max(...loadMW)))} cy={yScale(Math.max(...loadMW))} r={4} className="fill-rose-300" />
      </svg>
    </div>
  );
}
