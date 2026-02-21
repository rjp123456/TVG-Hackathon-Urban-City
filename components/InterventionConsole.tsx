"use client";

import { useState } from "react";
import { CityParams } from "@/types/city";

type InterventionConsoleProps = {
  params: CityParams;
  setParams: (updater: (prev: CityParams) => CityParams) => void;
};

type ToggleKey =
  | "microgridEnabled"
  | "demandResponseEnabled"
  | "heatwaveEnabled"
  | "stormEnabled"
  | "eventEnabled";

const toggleRows: Array<{ key: ToggleKey; label: string }> = [
  { key: "microgridEnabled", label: "Microgrid" },
  { key: "demandResponseEnabled", label: "Demand Response" },
  { key: "heatwaveEnabled", label: "Heatwave" },
  { key: "stormEnabled", label: "Storm" },
  { key: "eventEnabled", label: "Event" },
];

export function InterventionConsole({ params, setParams }: InterventionConsoleProps) {
  const [pulse, setPulse] = useState(false);

  const runSim = () => {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <section className="glass-panel p-4">
        <h2 className="text-sm uppercase tracking-[0.18em] text-emerald-300">Intervention Console</h2>
        <p className="mt-1 text-xs text-slate-300">Tune policy levers and stressors in real time.</p>

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
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  evAdoptionDelta: Number(e.target.value),
                }))
              }
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
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  solarDelta: Number(e.target.value),
                }))
              }
            />
          </label>

          <label className="block">
            <div className="mb-1 flex justify-between text-xs text-slate-300">
              <span>Storage MWh</span>
              <span>{params.storageMWh.toFixed(1)}</span>
            </div>
            <input
              className="city-slider h-2 w-full"
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={params.storageMWh}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  storageMWh: Number(e.target.value),
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="glass-panel p-4">
        <h3 className="text-xs uppercase tracking-[0.18em] text-cyan-300">Grid Flags</h3>
        <div className="mt-3 space-y-2">
          {toggleRows.map((row) => (
            <label key={row.key} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
              <span className="text-sm text-slate-200">{row.label}</span>
              <button
                type="button"
                onClick={() =>
                  setParams((prev) => ({
                    ...prev,
                    [row.key]: !prev[row.key],
                  }))
                }
                className={`relative h-6 w-11 rounded-full transition ${params[row.key] ? "bg-emerald-400/80" : "bg-slate-600/60"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    params[row.key] ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </label>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={runSim}
        className={`run-button mt-auto w-full rounded-xl px-4 py-3 text-sm font-semibold tracking-[0.1em] text-black ${
          pulse ? "run-button-pulse" : ""
        }`}
      >
        RUN 72H SIMULATION
      </button>
    </div>
  );
}
