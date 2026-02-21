"use client";

import { scenarios } from "@/lib/cityData";
import { ScenarioKey } from "@/types/city";

type TopBarProps = {
  selectedScenario: ScenarioKey;
  onScenarioChange: (key: ScenarioKey) => void;
  onReset: () => void;
  selectedHour: number;
  onHourChange: (hour: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  gridHealth: number;
  carbonIntensity: number;
  peakRisk: number;
};

export function TopBar({
  selectedScenario,
  onScenarioChange,
  onReset,
  selectedHour,
  onHourChange,
  isPlaying,
  onTogglePlay,
  gridHealth,
  carbonIntensity,
  peakRisk,
}: TopBarProps) {
  return (
    <header className="glass-panel flex flex-col gap-4 p-4 md:p-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-wide text-white">CityTwin AI</h1>
        <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
          Live Simulation
        </span>
      </div>

      <div className="flex min-w-[340px] flex-1 flex-col gap-2 xl:max-w-[620px]">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>T+0h</span>
          <span className="text-emerald-300">T+{selectedHour}h</span>
          <span>T+72h</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-10 min-w-10 rounded-lg border border-white/15 bg-white/5 text-sm text-slate-100 transition hover:border-emerald-300/70 hover:text-emerald-300"
            onClick={onTogglePlay}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={72}
            step={1}
            value={selectedHour}
            onChange={(e) => onHourChange(Number(e.target.value))}
            className="city-slider h-2 w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:flex xl:items-center">
        <select
          value={selectedScenario}
          onChange={(e) => onScenarioChange(e.target.value as ScenarioKey)}
          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-300/70"
        >
          {(Object.keys(scenarios) as ScenarioKey[]).map((key) => (
            <option key={key} value={key}>
              {scenarios[key].name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-teal-300/70 hover:text-teal-200"
        >
          Reset
        </button>

        <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-300">
          <div>Grid Health</div>
          <div className="text-sm font-semibold text-emerald-300">{gridHealth.toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-300">
          <div>Carbon</div>
          <div className="text-sm font-semibold text-cyan-300">{carbonIntensity.toFixed(0)} gCO2/kWh</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-300">
          <div>Peak Risk</div>
          <div className="text-sm font-semibold text-amber-300">{(peakRisk * 100).toFixed(0)}%</div>
        </div>
      </div>
    </header>
  );
}
