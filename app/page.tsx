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
import { CityParams, DistrictId, DistrictOverrides, ScenarioKey, SimulationResult } from "@/types/city";

type PinnedState = {
  label: string;
  params: CityParams;
  overrides: DistrictOverrides;
};

const withBudget = (params: Omit<CityParams, "budgetM">, budgetM: number): CityParams => ({
  ...params,
  budgetM,
});

export default function Page() {
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<ScenarioKey>("baseline");
  const [params, setParamsState] = useState<CityParams>(defaultParams);
  const [districtOverrides, setDistrictOverrides] = useState<DistrictOverrides>(emptyOverrides);
  const [selectedHour, setSelectedHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState<DistrictId>(districts[0].id);
  const [compareMode, setCompareMode] = useState(true);
  const [budgetWarning, setBudgetWarning] = useState("");

  const [pinnedA, setPinnedA] = useState<PinnedState>({
    label: "Baseline",
    params: defaultParams,
    overrides: emptyOverrides(),
  });

  const simCacheRef = useRef<Map<string, SimulationResult>>(new Map());
  const getSim = (p: CityParams, o: DistrictOverrides) => {
    const key = stableKey({ p, o });
    const existing = simCacheRef.current.get(key);
    if (existing) return existing;
    const created = runSimulation(p, o);
    simCacheRef.current.set(key, created);
    return created;
  };

  const [resultB, setResultB] = useState<SimulationResult>(() => getSim(params, districtOverrides));

  useEffect(() => {
    const id = window.setTimeout(() => {
      setResultB(getSim(params, districtOverrides));
    }, 180);
    return () => window.clearTimeout(id);
  }, [params, districtOverrides]);

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
    () => getSim(pinnedA.params, pinnedA.overrides),
    [pinnedA.params, pinnedA.overrides],
  );

  const recs = useMemo(
    () =>
      buildRecommendations({
        resultA,
        resultB,
        paramsB: params,
        overridesB: districtOverrides,
        selectedHour,
      }),
    [resultA, resultB, params, districtOverrides, selectedHour],
  );

  const budgetUsedM = useMemo(() => computeBudgetUsed(params, districtOverrides), [params, districtOverrides]);

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
    const delta = isOn ? - (key === "microgridEnabled" ? 1.5 : 0.2) : key === "microgridEnabled" ? 1.5 : 0.2;
    tryBudgetedChange(delta, () => {
      setParamsState((prev) => ({ ...prev, [key]: !prev[key] }));
    });
  };

  const updateSelectedDistrictOverride = (updater: (prev: DistrictOverrides[DistrictId]) => DistrictOverrides[DistrictId]) => {
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
  };

  const pinAsA = () => {
    setPinnedA({
      label: `${scenarios[selectedScenarioKey].name} (Pinned)`,
      params,
      overrides: districtOverrides,
    });
  };

  const selectedOverride = districtOverrides[selectedDistrictId];
  const interventionsCount = countInterventions(districtOverrides);

  const roiScore = useMemo(() => {
    const peakReduced = Math.max(0, resultA.city.peakLoad - resultB.city.peakLoad);
    const overloadsAvoided = Math.max(0, resultA.summaryAtPeak.overloadZones.length - resultB.summaryAtPeak.overloadZones.length);
    const resilienceDelta = Math.max(0, resultB.resilienceScore - resultA.resilienceScore);
    return (peakReduced * 0.6 + overloadsAvoided * 8 + resilienceDelta * 0.25) / Math.max(0.1, budgetUsedM);
  }, [resultA, resultB, budgetUsedM]);

  const opsBriefText = useMemo(() => {
    const topRisk = resultB.summaryAtPeak.topRisk
      .map((r) => `${r.id} (${(r.prob * 100).toFixed(0)}%)`)
      .join(", ");
    const topActions = recs.actions.map((a) => `${a.title}: ${a.impact.resilienceDelta >= 0 ? "+" : ""}${a.impact.resilienceDelta.toFixed(0)} resilience`).join(" | ");
    return [
      "CityTwin AI Ops Brief",
      `Peak Hour: T+${resultB.city.peakHour}h`,
      `Top Risk Districts: ${topRisk}`,
      `Budget Used: ${budgetUsedM.toFixed(2)}M / ${params.budgetM.toFixed(1)}M`,
      `Compare Delta: Peak ${recs.compare.peakDeltaMW.toFixed(1)} MW, Overloads ${recs.compare.overloadDelta}, Resilience ${recs.compare.resilienceDelta}`,
      `Top Actions: ${topActions}`,
    ].join("\n");
  }, [resultB, recs, budgetUsedM, params.budgetM]);

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
        />
      }
      left={
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
        />
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
            labelB={scenarios[selectedScenarioKey].name}
          />
        </div>
      }
    />
  );
}
