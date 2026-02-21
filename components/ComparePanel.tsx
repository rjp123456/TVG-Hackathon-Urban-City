"use client";

import { formatSigned } from "@/lib/utils";
import { CompareSummary } from "@/types/city";

type ComparePanelProps = {
  enabled: boolean;
  compare: CompareSummary;
  onPinAsA: () => void;
  labelA: string;
  labelB: string;
};

export function ComparePanel({ enabled, compare, onPinAsA, labelA, labelB }: ComparePanelProps) {
  if (!enabled) return null;

  const before = 100;
  const after = Math.max(20, 100 + compare.resilienceDelta * 1.5 - compare.overloadDelta * 10);

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.16em] text-cyan-300">Scenario Compare Mode</h3>
        <button
          type="button"
          onClick={onPinAsA}
          className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100"
        >
          Pin Current as A
        </button>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-2 text-xs text-slate-300">
        <div>Peak: <span className={compare.peakDeltaMW <= 0 ? "text-emerald-300" : "text-amber-300"}>{formatSigned(compare.peakDeltaMW, 1)} MW</span></div>
        <div>Overloads: <span className={compare.overloadDelta <= 0 ? "text-emerald-300" : "text-amber-300"}>{formatSigned(compare.overloadDelta, 0)}</span></div>
        <div>Resilience: <span className={compare.resilienceDelta >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatSigned(compare.resilienceDelta, 0)}</span></div>
        <div>Carbon: <span className={compare.carbonDelta <= 0 ? "text-emerald-300" : "text-amber-300"}>{formatSigned(compare.carbonDelta, 1)}</span></div>
        <div>Cost Savings: <span className={compare.costSavingsPct >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatSigned(compare.costSavingsPct, 1)}%</span></div>
      </div>

      <div className="mt-3 text-[11px] text-slate-400">Before / After Resilience Proxy</div>
      <div className="mt-1 space-y-2">
        <div>
          <div className="mb-1 text-[10px] text-slate-400">A: {labelA}</div>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-slate-400/70" style={{ width: `${before}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-slate-400">B: {labelB}</div>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400/90" style={{ width: `${Math.min(100, after)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
