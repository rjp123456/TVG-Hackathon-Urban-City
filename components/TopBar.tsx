"use client";

import { AlertTimeline } from "@/components/AlertTimeline";
import { scenarios } from "@/lib/cityData";
import { AlertPoint, ScenarioKey } from "@/types/city";

type TopBarProps = {
  selectedScenario: ScenarioKey;
  onScenarioChange: (key: ScenarioKey) => void;
  onReset: () => void;
  selectedHour: number;
  onHourChange: (hour: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  alerts: AlertPoint[];
  compareMode: boolean;
  onToggleCompareMode: () => void;
  carbonIntensity: number;
  costIndex: number;
  budgetUsedM: number;
  budgetM: number;
  interventionsCount: number;
  liveMode: boolean;
  lastSyncedISO: string | null;
  onRefreshLive: () => void;
  liveRefreshing: boolean;
};

export function TopBar({
  selectedScenario,
  onScenarioChange,
  onReset,
  selectedHour,
  onHourChange,
  isPlaying,
  onTogglePlay,
  alerts,
  compareMode,
  onToggleCompareMode,
  carbonIntensity,
  costIndex,
  budgetUsedM,
  budgetM,
  interventionsCount,
  liveMode,
  lastSyncedISO,
  onRefreshLive,
  liveRefreshing,
}: TopBarProps) {
  return (
    <header className="glass-panel flex flex-col gap-4 p-4 md:p-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-wide text-white">CityTwin AI Austin</h1>
        <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
          Live Simulation
        </span>
        {liveMode && (
          <span className="inline-flex items-center rounded-full border border-cyan-300/50 bg-cyan-300/12 px-3 py-1 text-xs text-cyan-200">
            Live ERCOT Data - Updated {lastSyncedISO ? new Date(lastSyncedISO).toLocaleTimeString() : "now"}
          </span>
        )}
      </div>

      <div className="flex min-w-[340px] flex-1 flex-col gap-1 xl:max-w-[700px]">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Operational Horizon: 72h</span>
          <span className="text-emerald-300">T+{selectedHour}h</span>
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
        <AlertTimeline alerts={alerts} selectedHour={selectedHour} onJump={onHourChange} />
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

        <button
          type="button"
          onClick={onToggleCompareMode}
          className={`rounded-lg border px-3 py-2 text-sm transition ${
            compareMode
              ? "border-cyan-300/70 bg-cyan-300/10 text-cyan-100"
              : "border-white/15 bg-white/5 text-slate-200"
          }`}
        >
          Compare {compareMode ? "ON" : "OFF"}
        </button>

        <button
          type="button"
          onClick={onRefreshLive}
          disabled={liveRefreshing}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition enabled:hover:border-teal-300/70 disabled:opacity-50"
        >
          {liveRefreshing ? "Syncing..." : "Refresh"}
        </button>

        <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-300">
          <div>Last Synced</div>
          <div className="text-sm font-semibold text-cyan-300">
            {lastSyncedISO ? new Date(lastSyncedISO).toLocaleTimeString() : "-"}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-300">
          <div>Carbon Intensity</div>
          <div className="text-sm font-semibold text-cyan-300">{carbonIntensity.toFixed(0)} gCO2/kWh</div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-300">
          <div>Cost Pressure</div>
          <div className="text-sm font-semibold text-amber-300">{costIndex.toFixed(2)}x</div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-300">
          <div>Placed Interventions</div>
          <div className="text-sm font-semibold text-emerald-300">{interventionsCount}</div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-300">
          <div>Budget</div>
          <div className="text-sm font-semibold text-emerald-300">
            {budgetUsedM.toFixed(2)} / {budgetM.toFixed(1)}M
          </div>
        </div>
      </div>
    </header>
  );
}
