"use client";

type MetricCardsProps = {
  resilienceScore: number;
  peakLoad: number;
  overloadZones: number;
  carbonIntensity: number;
};

export function MetricCards({ resilienceScore, peakLoad, overloadZones, carbonIntensity }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="glass-panel p-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Resilience Score</div>
        <div className="mt-1 text-2xl font-semibold text-emerald-300">{resilienceScore}</div>
      </div>
      <div className="glass-panel p-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Peak Load</div>
        <div className="mt-1 text-2xl font-semibold text-cyan-300">{peakLoad.toFixed(0)} MW</div>
      </div>
      <div className="glass-panel p-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Overload Zones</div>
        <div className={`mt-1 text-2xl font-semibold ${overloadZones > 0 ? "text-rose-300" : "text-emerald-300"}`}>
          {overloadZones}
        </div>
      </div>
      <div className="glass-panel p-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Carbon @ T</div>
        <div className="mt-1 text-2xl font-semibold text-amber-300">{carbonIntensity.toFixed(0)}</div>
      </div>
    </div>
  );
}
