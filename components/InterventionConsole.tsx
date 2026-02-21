"use client";

import { useState } from "react";
import { districts } from "@/lib/cityData";
import { formatMoneyM } from "@/lib/utils";
import { CityParams, DistrictId, DistrictOverride } from "@/types/city";

type ToggleKey =
  | "microgridEnabled"
  | "demandResponseEnabled"
  | "heatwaveEnabled"
  | "stormEnabled"
  | "eventEnabled"
  | "criticalPriorityEnabled";

type InterventionConsoleProps = {
  params: CityParams;
  setParams: (updater: (prev: CityParams) => CityParams) => void;
  selectedDistrictId: DistrictId;
  selectedOverride: DistrictOverride;
  onAddDistrictStorage: (deltaMWh: number) => void;
  onAddDistrictCap: (deltaMW: number) => void;
  onAddDistrictSolar: (delta: number) => void;
  onToggleDistrictDr: () => void;
  onClearDistrictOverride: () => void;
  budgetUsedM: number;
  roiScore: number;
  budgetWarning: string;
  onBudgetedGlobalToggle: (key: "microgridEnabled" | "demandResponseEnabled") => void;
  liveMode?: boolean;
};

const toggleRows: Array<{ key: ToggleKey; label: string; budgeted?: boolean }> = [
  { key: "microgridEnabled", label: "Microgrid", budgeted: true },
  { key: "demandResponseEnabled", label: "Demand Response", budgeted: true },
  { key: "criticalPriorityEnabled", label: "Critical Priority" },
  { key: "heatwaveEnabled", label: "Heatwave" },
  { key: "stormEnabled", label: "Storm" },
  { key: "eventEnabled", label: "Event" },
];

export function InterventionConsole({
  params,
  setParams,
  selectedDistrictId,
  selectedOverride,
  onAddDistrictStorage,
  onAddDistrictCap,
  onAddDistrictSolar,
  onToggleDistrictDr,
  onClearDistrictOverride,
  budgetUsedM,
  roiScore,
  budgetWarning,
  onBudgetedGlobalToggle,
  liveMode,
}: InterventionConsoleProps) {
  const [pulse, setPulse] = useState(false);

  const districtName = districts.find((d) => d.id === selectedDistrictId)?.name ?? selectedDistrictId;

  return (
    <div className="flex h-full flex-col gap-3">
      <section className="glass-panel p-4">
        <h2 className="text-sm uppercase tracking-[0.18em] text-emerald-300">Intervention Sandbox</h2>
        <p className="mt-1 text-xs text-slate-300">Tune global levers and district placements in real time.</p>
        {liveMode && (
          <p className="mt-1 text-[11px] text-cyan-200">
            Real ERCOT curves active; local district distribution remains modeled.
          </p>
        )}

        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <div className="mb-1 flex justify-between text-xs text-slate-300">
              <span>EV Adoption Delta</span>
              <span>{params.evAdoptionDelta.toFixed(2)}</span>
            </div>
            <input
              className="city-slider h-2 w-full"
              type="range"
              min={-0.05}
              max={0.3}
              step={0.01}
              value={params.evAdoptionDelta}
              onChange={(e) => setParams((prev) => ({ ...prev, evAdoptionDelta: Number(e.target.value) }))}
            />
          </label>

          <label className="block">
            <div className="mb-1 flex justify-between text-xs text-slate-300">
              <span>Solar Delta</span>
              <span>{params.solarDelta.toFixed(2)}</span>
            </div>
            <input
              className="city-slider h-2 w-full"
              type="range"
              min={-0.1}
              max={0.3}
              step={0.01}
              value={params.solarDelta}
              onChange={(e) => setParams((prev) => ({ ...prev, solarDelta: Number(e.target.value) }))}
            />
          </label>

          <label className="block">
            <div className="mb-1 flex justify-between text-xs text-slate-300">
              <span>Global Storage MWh</span>
              <span>{params.storageMWh.toFixed(1)}</span>
            </div>
            <input
              className="city-slider h-2 w-full"
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={params.storageMWh}
              onChange={(e) => setParams((prev) => ({ ...prev, storageMWh: Number(e.target.value) }))}
            />
          </label>
        </div>
      </section>

      <section className="glass-panel p-4">
        <h3 className="text-xs uppercase tracking-[0.18em] text-cyan-300">Grid Flags</h3>
        <div className="mt-3 space-y-2">
          {toggleRows.map((row) => (
            <label key={row.key} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
              <span className="text-sm text-slate-200">
                {row.label}
                {row.budgeted && <span className="ml-1 text-[10px] text-slate-400">(Budgeted)</span>}
              </span>
              <button
                type="button"
                onClick={() =>
                  row.budgeted
                    ? onBudgetedGlobalToggle(row.key as "microgridEnabled" | "demandResponseEnabled")
                    : setParams((prev) => ({ ...prev, [row.key]: !prev[row.key] }))
                }
                className={`relative h-6 w-11 rounded-full transition ${params[row.key] ? "bg-emerald-400/80" : "bg-slate-600/60"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${params[row.key] ? "left-5" : "left-0.5"}`} />
              </button>
            </label>
          ))}
        </div>
      </section>

      <section className="glass-panel p-4">
        <h3 className="text-xs uppercase tracking-[0.18em] text-emerald-300">Budget & ROI</h3>
        <div className="mt-2 text-xs text-slate-300">
          <div className="flex justify-between">
            <span>Budget Used</span>
            <span className={budgetUsedM > params.budgetM ? "text-rose-300" : "text-emerald-300"}>
              {formatMoneyM(budgetUsedM)} / {formatMoneyM(params.budgetM)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full ${budgetUsedM > params.budgetM ? "bg-rose-400" : "bg-emerald-400"}`}
              style={{ width: `${Math.min(100, (budgetUsedM / Math.max(0.1, params.budgetM)) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between">
            <span>ROI Score</span>
            <span className="text-cyan-300">{roiScore.toFixed(2)}</span>
          </div>

          <label className="mt-2 block">
            <div className="mb-1 flex justify-between text-xs">
              <span>Total Budget</span>
              <span>{formatMoneyM(params.budgetM)}</span>
            </div>
            <input
              className="city-slider h-2 w-full"
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={params.budgetM}
              onChange={(e) => setParams((prev) => ({ ...prev, budgetM: Number(e.target.value) }))}
            />
          </label>
        </div>
        {budgetWarning && <div className="mt-2 rounded-md border border-rose-300/40 bg-rose-400/10 px-2 py-1 text-xs text-rose-200">{budgetWarning}</div>}
      </section>

      <section className="glass-panel p-4">
        <h3 className="text-xs uppercase tracking-[0.18em] text-cyan-300">District Actions: {districtName}</h3>
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Battery</span>
            <div className="flex gap-1">
              <button className="mini-btn" onClick={() => onAddDistrictStorage(0.5)}>+0.5 MWh</button>
              <button className="mini-btn" onClick={() => onAddDistrictStorage(1)}>+1.0 MWh</button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Transformer Upgrade</span>
            <div className="flex gap-1">
              <button className="mini-btn" onClick={() => onAddDistrictCap(5)}>+5 MW</button>
              <button className="mini-btn" onClick={() => onAddDistrictCap(10)}>+10 MW</button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Solar Incentive</span>
            <div className="flex gap-1">
              <button className="mini-btn" onClick={() => onAddDistrictSolar(0.05)}>+5%</button>
              <button className="mini-btn" onClick={() => onAddDistrictSolar(0.1)}>+10%</button>
            </div>
          </div>

          <label className="mt-2 flex items-center justify-between rounded-md border border-white/10 px-2 py-2">
            <span>Local Demand Response</span>
            <button
              type="button"
              onClick={onToggleDistrictDr}
              className={`relative h-6 w-11 rounded-full transition ${selectedOverride.drEnabled ? "bg-emerald-400/80" : "bg-slate-600/60"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${selectedOverride.drEnabled ? "left-5" : "left-0.5"}`} />
            </button>
          </label>

          <div className="mt-2 text-[11px] text-slate-400">
            Installed: BAT {(selectedOverride.storageMWh ?? 0).toFixed(1)} MWh | CAP +
            {(selectedOverride.capBoostMW ?? 0).toFixed(0)} MW | SOL +
            {((selectedOverride.solarBoost ?? 0) * 100).toFixed(0)}%
            {selectedOverride.drEnabled ? " | DR ON" : ""}
          </div>

          <button
            type="button"
            onClick={onClearDistrictOverride}
            className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-2 py-2 text-xs text-slate-200 hover:border-cyan-300/70"
          >
            Clear District Overrides
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={() => {
          setPulse(true);
          window.setTimeout(() => setPulse(false), 550);
        }}
        className={`run-button mt-auto w-full rounded-xl px-4 py-3 text-sm font-semibold tracking-[0.1em] text-black ${pulse ? "run-button-pulse" : ""}`}
      >
        RUN 72H SIMULATION
      </button>
    </div>
  );
}
