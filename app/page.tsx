"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AIPanel } from "@/components/AIPanel";
import { ComparePanel } from "@/components/ComparePanel";
import { DistrictDrivers } from "@/components/DistrictDrivers";
import { ForecastChart } from "@/components/ForecastChart";
import { HexCityMap } from "@/components/HexCityMap";
import { InterventionConsole } from "@/components/InterventionConsole";
import { MetricCards } from "@/components/MetricCards";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { defaultParams, districts, edges, scenarios } from "@/lib/cityData";
import { buildRecommendations } from "@/lib/recommendations";
import { runSimulation } from "@/lib/simulation";
import {
  canAffordChange,
  clamp,
  computeBudgetUsed,
  countInterventions,
  emptyOverrides,
  stableKey,
} from "@/lib/utils";
import {
  CityParams,
  DistrictId,
  DistrictOverrides,
  LiveInputs,
  ScenarioKey,
  SimulationResult,
} from "@/types/city";

type ErcotBasicResponse = {
  ok: boolean;
  timestampISO: string;
  systemDemandMW: number;
  windMW: number;
  solarMW: number;
  renewablesShare?: number;
};

type PinnedState = {
  label: string;
  params: CityParams;
  overrides: DistrictOverrides;
  liveInputs: LiveInputs | null;
};

const withBudget = (params: Omit<CityParams, "budgetM">, budgetM: number): CityParams => ({
  ...params,
  budgetM,
});

const buildLiveSeedInputs = (seed: ErcotBasicResponse, synthetic: SimulationResult): LiveInputs => {
  const renewablesShare =
    seed.renewablesShare ?? (seed.windMW + seed.solarMW) / Math.max(1, seed.systemDemandMW);
  const demandScale = clamp(seed.systemDemandMW / 72000, 0.7, 1.4);

  const demandCurveMW = synthetic.city.loadMW.map((v) => v * demandScale);
  const capacityCurveMW = synthetic.city.capMW.map((v) => v * demandScale * 1.02);
  const carbonSeed = clamp(420 - 260 * renewablesShare, 180, 520);
  const carbonIntensityCurve = synthetic.city.carbonIntensity.map(() => carbonSeed);

  return {
    liveMode: true,
    liveLabel: "Austin (proxy: ERCOT system seed)",
    fetchedAtISO: seed.timestampISO,
    demandCurveMW,
    capacityCurveMW,
    renewablesCurve: {
      windMW: synthetic.city.loadMW.map(() => seed.windMW * demandScale),
      solarMW: synthetic.city.loadMW.map(() => seed.solarMW * demandScale),
    },
    carbonIntensityCurve,
    costIndexCurve: synthetic.city.costIndex.slice(),
  };
};

export default function Page() {
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<ScenarioKey>("baseline");
  const [params, setParamsState] = useState<CityParams>(defaultParams);
  const [districtOverrides, setDistrictOverrides] = useState<DistrictOverrides>(emptyOverrides);
  const [selectedHour, setSelectedHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState<DistrictId>(districts[0].id);
  const [compareMode, setCompareMode] = useState(true);
  const [budgetWarning, setBudgetWarning] = useState("");
  const [uiWarning, setUiWarning] = useState("");

  const [liveMode, setLiveMode] = useState(false);
  const [liveInputs, setLiveInputs] = useState<LiveInputs | null>(null);
  const [liveSyncedAtISO, setLiveSyncedAtISO] = useState<string | null>(null);
  const [liveFetchPending, setLiveFetchPending] = useState(false);

  const lastLiveFetchMsRef = useRef(0);
  const liveSeedCacheRef = useRef<ErcotBasicResponse | null>(null);

  const [pinnedA, setPinnedA] = useState<PinnedState>({
    label: "Baseline",
    params: defaultParams,
    overrides: emptyOverrides(),
    liveInputs: null,
  });

  const simCacheRef = useRef<Map<string, SimulationResult>>(new Map());
  const getSim = (p: CityParams, o: DistrictOverrides, live: LiveInputs | null) => {
    const key = stableKey({ p, o, liveLabel: live?.liveLabel ?? "synthetic", liveAt: live?.fetchedAtISO ?? "none" });
    const existing = simCacheRef.current.get(key);
    if (existing) return existing;
    const created = runSimulation(p, o, live);
    simCacheRef.current.set(key, created);
    return created;
  };

  const [resultB, setResultB] = useState<SimulationResult>(() => getSim(params, districtOverrides, liveInputs));

  useEffect(() => {
    const id = window.setTimeout(() => {
      setResultB(getSim(params, districtOverrides, liveInputs));
    }, 180);
    return () => window.clearTimeout(id);
  }, [params, districtOverrides, liveInputs]);

  useEffect(() => {
    let raf = 0;
    let last = 0;

    const loop = (time: number) => {
      if (!isPlaying) return;
      if (time - last >= 120) {
        last = time;
        setSelectedHour((prev) => {
          if (prev >= 72) {
            setIsPlaying(false);
            return 72;
          }
          return prev + 1;
        });
      }
      raf = requestAnimationFrame(loop);
    };

    if (isPlaying) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const resultA = useMemo(
    () => getSim(pinnedA.params, pinnedA.overrides, pinnedA.liveInputs),
    [pinnedA.params, pinnedA.overrides, pinnedA.liveInputs],
  );

  const recs = useMemo(
    () =>
      buildRecommendations({
        resultA,
        resultB,
        paramsB: params,
        overridesB: districtOverrides,
        selectedHour,
        liveInputsB: liveInputs,
      }),
    [resultA, resultB, params, districtOverrides, selectedHour, liveInputs],
  );

  const budgetUsedM = useMemo(() => computeBudgetUsed(params, districtOverrides), [params, districtOverrides]);

  const fetchLiveData = async (force = false) => {
    if (liveFetchPending) return;
    const now = Date.now();
    if (!force && now - lastLiveFetchMsRef.current < 5 * 60 * 1000 && liveSeedCacheRef.current) {
      setLiveInputs(buildLiveSeedInputs(liveSeedCacheRef.current, resultB));
      setLiveSyncedAtISO(liveSeedCacheRef.current.timestampISO);
      return;
    }

    setLiveFetchPending(true);
    try {
      const res = await fetch("/api/ercot/basic", { cache: "no-store" });
      const payload = (await res.json()) as ErcotBasicResponse;
      if (!res.ok || !payload.ok) throw new Error("basic feed unavailable");

      liveSeedCacheRef.current = payload;
      lastLiveFetchMsRef.current = now;
      setLiveInputs(buildLiveSeedInputs(payload, resultB));
      setLiveSyncedAtISO(payload.timestampISO);
      setUiWarning("");
    } catch {
      setLiveMode(false);
      setLiveInputs(null);
      setUiWarning("");
    } finally {
      setLiveFetchPending(false);
    }
  };

  useEffect(() => {
    if (liveMode) void fetchLiveData(false);
    if (!liveMode) setLiveInputs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode]);

  const tryBudgetedChange = (deltaCostM: number, apply: () => void) => {
    const affordable = deltaCostM <= 0 || canAffordChange(params.budgetM, budgetUsedM, deltaCostM);
    if (affordable) {
      setBudgetWarning("");
      apply();
      return;
    }
    setBudgetWarning("Budget exceeded");
  };

  const onBudgetedGlobalToggle = (key: "microgridEnabled" | "demandResponseEnabled") => {
    const isOn = params[key];
    const delta = isOn ? -(key === "microgridEnabled" ? 1.5 : 0.2) : key === "microgridEnabled" ? 1.5 : 0.2;
    tryBudgetedChange(delta, () => {
      setParamsState((prev) => ({ ...prev, [key]: !prev[key] }));
    });
  };

  const updateSelectedDistrictOverride = (
    updater: (prev: DistrictOverrides[DistrictId]) => DistrictOverrides[DistrictId],
  ) => {
    setDistrictOverrides((prev) => ({ ...prev, [selectedDistrictId]: updater(prev[selectedDistrictId]) }));
  };

  const onAddDistrictStorage = (deltaMWh: number) => {
    tryBudgetedChange(deltaMWh * 0.6, () => {
      updateSelectedDistrictOverride((prev) => ({
        ...prev,
        storageMWh: clamp((prev.storageMWh ?? 0) + deltaMWh, 0, 5),
      }));
    });
  };

  const onAddDistrictCap = (deltaMW: number) => {
    tryBudgetedChange((deltaMW / 10) * 0.35, () => {
      updateSelectedDistrictOverride((prev) => ({ ...prev, capBoostMW: (prev.capBoostMW ?? 0) + deltaMW }));
    });
  };

  const onAddDistrictSolar = (delta: number) => {
    tryBudgetedChange((delta / 0.1) * 0.25, () => {
      updateSelectedDistrictOverride((prev) => ({
        ...prev,
        solarBoost: clamp((prev.solarBoost ?? 0) + delta, 0, 0.35),
      }));
    });
  };

  const onToggleDistrictDr = () => {
    const isOn = Boolean(districtOverrides[selectedDistrictId].drEnabled);
    tryBudgetedChange(isOn ? -0.2 : 0.2, () => {
      updateSelectedDistrictOverride((prev) => ({ ...prev, drEnabled: !prev.drEnabled }));
    });
  };

  const onClearDistrictOverride = () => {
    updateSelectedDistrictOverride(() => ({}));
  };

  const applyScenario = (key: ScenarioKey) => {
    setSelectedScenarioKey(key);
    setParamsState((prev) => ({ ...withBudget(scenarios[key].params, prev.budgetM) }));
    setDistrictOverrides(emptyOverrides());
  };

  const resetAll = () => {
    setSelectedScenarioKey("baseline");
    setParamsState(defaultParams);
    setDistrictOverrides(emptyOverrides());
    setSelectedHour(0);
    setIsPlaying(false);
    setSelectedDistrictId(districts[0].id);
    setBudgetWarning("");
    setUiWarning("");
  };

  const pinAsA = () => {
    setPinnedA({
      label: `${scenarios[selectedScenarioKey].name}${liveMode ? " + Live" : ""} (Pinned)`,
      params,
      overrides: districtOverrides,
      liveInputs,
    });
  };

  const selectedOverride = districtOverrides[selectedDistrictId];
  const interventionsCount = countInterventions(districtOverrides);

  const roiScore = useMemo(() => {
    const peakReduced = Math.max(0, resultA.city.peakLoad - resultB.city.peakLoad);
    const overloadsAvoided = Math.max(
      0,
      resultA.summaryAtPeak.overloadZones.length - resultB.summaryAtPeak.overloadZones.length,
    );
    const resilienceDelta = Math.max(0, resultB.resilienceScore - resultA.resilienceScore);
    return (peakReduced * 0.6 + overloadsAvoided * 8 + resilienceDelta * 0.25) / Math.max(0.1, budgetUsedM);
  }, [resultA, resultB, budgetUsedM]);

  const opsBriefText = useMemo(() => {
    const topRisk = resultB.summaryAtPeak.topRisk
      .map((r) => `${r.id} (${(r.prob * 100).toFixed(0)}%)`)
      .join(", ");
    const topActions = recs.actions
      .map((a) => `${a.title}: ${a.impact.resilienceDelta >= 0 ? "+" : ""}${a.impact.resilienceDelta.toFixed(0)} resilience`)
      .join(" | ");
    return [
      "CityTwin AI Ops Brief",
      `Mode: ${liveMode ? liveInputs?.liveLabel ?? "Live" : "Synthetic"}`,
      `Peak Hour: T+${resultB.city.peakHour}h`,
      `Top Risk Districts: ${topRisk}`,
      `Budget Used: ${budgetUsedM.toFixed(2)}M / ${params.budgetM.toFixed(1)}M`,
      `Compare Delta: Peak ${recs.compare.peakDeltaMW.toFixed(1)} MW, Overloads ${recs.compare.overloadDelta}, Resilience ${recs.compare.resilienceDelta}`,
      `Top Actions: ${topActions}`,
    ].join("\n");
  }, [resultB, recs, budgetUsedM, params.budgetM, liveMode, liveInputs]);

  return (
    <Shell
      topBar={
        <TopBar
          selectedScenario={selectedScenarioKey}
          onScenarioChange={applyScenario}
          onReset={resetAll}
          selectedHour={selectedHour}
          onHourChange={setSelectedHour}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((v) => !v)}
          alerts={resultB.alertHours}
          compareMode={compareMode}
          onToggleCompareMode={() => setCompareMode((v) => !v)}
          carbonIntensity={resultB.city.carbonIntensity[selectedHour]}
          costIndex={resultB.city.costIndex[selectedHour]}
          budgetUsedM={budgetUsedM}
          budgetM={params.budgetM}
          interventionsCount={interventionsCount}
          liveMode={liveMode}
          lastSyncedISO={liveSyncedAtISO}
          onToggleLiveMode={() => setLiveMode((v) => !v)}
          onRefreshLive={() => void fetchLiveData(true)}
          liveRefreshing={liveFetchPending}
        />
      }
      left={
        <div className="flex h-full flex-col gap-3">
          {uiWarning && (
            <div className="glass-panel border-rose-300/35 bg-rose-500/10 p-3 text-xs text-rose-200">
              {uiWarning}
            </div>
          )}
          <InterventionConsole
            params={params}
            setParams={setParamsState}
            selectedDistrictId={selectedDistrictId}
            selectedOverride={selectedOverride}
            onAddDistrictStorage={onAddDistrictStorage}
            onAddDistrictCap={onAddDistrictCap}
            onAddDistrictSolar={onAddDistrictSolar}
            onToggleDistrictDr={onToggleDistrictDr}
            onClearDistrictOverride={onClearDistrictOverride}
            budgetUsedM={budgetUsedM}
            roiScore={roiScore}
            budgetWarning={budgetWarning}
            onBudgetedGlobalToggle={onBudgetedGlobalToggle}
            liveMode={liveMode}
          />
        </div>
      }
      center={
        <HexCityMap
          districts={districts}
          edges={edges}
          overrides={districtOverrides}
          criticalPriorityEnabled={params.criticalPriorityEnabled}
          result={resultB}
          selectedHour={selectedHour}
          selectedDistrictId={selectedDistrictId}
          setSelectedDistrictId={setSelectedDistrictId}
        />
      }
      right={
        <div className="flex h-full flex-col gap-3">
          <MetricCards
            resilienceScore={resultB.resilienceScore}
            peakLoad={resultB.city.peakLoad}
            overloadZones={resultB.summaryAtPeak.overloadZones.length}
            carbonIntensity={resultB.city.carbonIntensity[selectedHour]}
            costIndex={resultB.city.costIndex[selectedHour]}
          />
          <DistrictDrivers result={resultB} selectedDistrictId={selectedDistrictId} selectedHour={selectedHour} />
          <AIPanel
            result={resultB}
            selectedHour={selectedHour}
            selectedDistrictId={selectedDistrictId}
            recs={recs}
            opsBriefText={opsBriefText}
          />
        </div>
      }
      bottom={
        <div className="grid gap-3 xl:grid-cols-[1fr_420px]">
          <ForecastChart
            hours={resultB.hours}
            loadMW={resultB.city.loadMW}
            capMW={resultB.city.capMW}
            selectedHour={selectedHour}
            onHourChange={setSelectedHour}
            uncertaintyScale={params.stormEnabled || params.heatwaveEnabled ? 1.5 : 1}
          />
          <ComparePanel
            enabled={compareMode}
            compare={recs.compare}
            onPinAsA={pinAsA}
            labelA={pinnedA.label}
            labelB={`${scenarios[selectedScenarioKey].name}${liveMode ? " + Live" : ""}`}
          />
        </div>
      }
    />
  );
}
