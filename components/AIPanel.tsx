"use client";

import { districts } from "@/lib/cityData";
import {
  formatImpact,
  formatOverloadDelta,
  formatResilienceDelta,
} from "@/lib/recommendations";
import { RecommendationOutput, SimulationResult, DistrictId } from "@/types/city";

type AIPanelProps = {
  result: SimulationResult;
  selectedHour: number;
  selectedDistrictId: DistrictId;
  recs: RecommendationOutput;
};

export function AIPanel({ result, selectedHour, selectedDistrictId, recs }: AIPanelProps) {
  const district = districts.find((d) => d.id === selectedDistrictId) ?? districts[0];
  const load = result.perDistrict[district.id].loadMW[selectedHour];
  const cap = result.perDistrict[district.id].capMW[selectedHour];
  const stress = result.perDistrict[district.id].stress[selectedHour];
  const prob = result.perDistrict[district.id].prob[selectedHour];

  return (
    <div className="flex h-full flex-col gap-3">
      <section className="glass-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.18em] text-emerald-300">AI Command Panel</h2>
          <span className="text-xs text-slate-400">T+{selectedHour}h</span>
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-black/35 p-3">
          <div className="text-xs uppercase tracking-[0.15em] text-cyan-300">Selected District</div>
          <div className="mt-1 text-lg font-medium text-white">{district.name}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div>Load: {load.toFixed(1)} MW</div>
            <div>Cap: {cap.toFixed(1)} MW</div>
            <div>Stress: {(stress * 100).toFixed(0)}%</div>
            <div>Overload: {(prob * 100).toFixed(0)}%</div>
          </div>
        </div>
      </section>

      <section className="glass-panel flex min-h-[180px] flex-col p-4">
        <h3 className="text-xs uppercase tracking-[0.16em] text-slate-300">Mission Risk Feed</h3>
        <div className="mt-2 max-h-[170px] space-y-2 overflow-y-auto pr-1 text-xs">
          {recs.riskFeed.map((entry, idx) => (
            <div
              key={`${entry.text}-${idx}`}
              className={`rounded-md border px-3 py-2 ${
                entry.type === "warn"
                  ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                  : entry.type === "ok"
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                    : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
              }`}
            >
              {entry.text}
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel flex-1 p-4">
        <h3 className="text-xs uppercase tracking-[0.16em] text-slate-300">Recommended Actions</h3>
        <div className="mt-2 space-y-2">
          {recs.actions.map((action) => (
            <article key={action.title} className="rounded-md border border-white/10 bg-black/35 p-3 text-xs text-slate-200">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-white">{action.title}</h4>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] text-emerald-300">
                  {action.confidence}
                </span>
              </div>
              <p className="mt-1 text-slate-300">{action.rationale}</p>
              <p className="mt-1 text-cyan-200">{action.impact}</p>
            </article>
          ))}
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/35 p-3 text-xs text-slate-200">
          <div className="mb-1 uppercase tracking-[0.14em] text-slate-400">Impact Summary vs Baseline</div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-slate-400">Peak Δ</div>
              <div className={recs.impactSummary.peakDelta <= 0 ? "text-emerald-300" : "text-amber-300"}>
                {formatImpact(recs.impactSummary.peakDelta, " MW")}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Overloads Δ</div>
              <div className={recs.impactSummary.overloadDelta <= 0 ? "text-emerald-300" : "text-amber-300"}>
                {formatOverloadDelta(recs.impactSummary.overloadDelta)}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Resilience Δ</div>
              <div className={recs.impactSummary.resilienceDelta >= 0 ? "text-emerald-300" : "text-rose-300"}>
                {formatResilienceDelta(recs.impactSummary.resilienceDelta)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
