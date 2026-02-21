"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AIPanel } from "@/components/AIPanel";
import { ForecastChart } from "@/components/ForecastChart";
import { HexCityMap } from "@/components/HexCityMap";
import { InterventionConsole } from "@/components/InterventionConsole";
import { MetricCards } from "@/components/MetricCards";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { districts, edges, scenarios } from "@/lib/cityData";
import { buildRecommendations } from "@/lib/recommendations";
import { runSimulation } from "@/lib/simulation";
import { CityParams, ScenarioKey } from "@/types/city";

const baselineParams: CityParams = { ...scenarios.baseline.params };

export default function Page() {
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<ScenarioKey>("baseline");
  const [params, setParamsState] = useState<CityParams>({ ...scenarios.baseline.params });
  const [selectedHour, setSelectedHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState(districts[0].id);

  const baselineResult = useMemo(() => runSimulation(baselineParams), []);
  const [simulationResult, setSimulationResult] = useState(() => runSimulation(params));

  const setParams = (updater: (prev: CityParams) => CityParams) => {
    setParamsState((prev) => updater(prev));
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSimulationResult(runSimulation(params));
    }, 150);
    return () => window.clearTimeout(id);
  }, [params]);

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

  const recs = useMemo(
    () => buildRecommendations(simulationResult, params, baselineResult),
    [simulationResult, params, baselineResult],
  );

  const gridHealth = useMemo(() => {
    const stressAvg =
      districts.reduce((sum, d) => sum + simulationResult.perDistrict[d.id].stress[selectedHour], 0) /
      districts.length;
    return Math.max(0, 100 - stressAvg * 62);
  }, [simulationResult, selectedHour]);

  const peakRisk = useMemo(
    () => Math.max(...districts.map((d) => simulationResult.perDistrict[d.id].prob[selectedHour])),
    [simulationResult, selectedHour],
  );

  const applyScenario = (key: ScenarioKey) => {
    setSelectedScenarioKey(key);
    setParamsState({ ...scenarios[key].params });
  };

  const resetAll = () => {
    setSelectedScenarioKey("baseline");
    setParamsState({ ...scenarios.baseline.params });
    setSelectedHour(0);
    setIsPlaying(false);
    setSelectedDistrictId(districts[0].id);
  };

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
          gridHealth={gridHealth}
          carbonIntensity={simulationResult.city.carbonIntensity[selectedHour]}
          peakRisk={peakRisk}
        />
      }
      left={
        <div className="flex flex-col gap-3">
          <InterventionConsole params={params} setParams={setParams} />
          <section className="glass-panel p-4 text-xs text-slate-300">
            <h3 className="mb-2 uppercase tracking-[0.18em] text-emerald-300">Demo Script</h3>
            <p>Baseline: Resilience in the 70s.</p>
            <p>Heatwave + EV Surge: Downtown spikes red near T+18h.</p>
            <p>Enable Storage 3MWh + Microgrid + Demand Response: stress drops and resilience jumps.</p>
            <p className="mt-2 text-cyan-200">Cities can test interventions before spending millions.</p>
          </section>
        </div>
      }
      center={
        <HexCityMap
          districts={districts}
          edges={edges}
          result={simulationResult}
          selectedHour={selectedHour}
          selectedDistrictId={selectedDistrictId}
          setSelectedDistrictId={setSelectedDistrictId}
        />
      }
      right={
        <div className="flex h-full flex-col gap-3">
          <MetricCards
            resilienceScore={simulationResult.resilienceScore}
            peakLoad={simulationResult.city.peakLoad}
            overloadZones={simulationResult.summaryAtHour.overloadZones.length}
            carbonIntensity={simulationResult.city.carbonIntensity[selectedHour]}
          />
          <AIPanel
            result={simulationResult}
            selectedHour={selectedHour}
            selectedDistrictId={selectedDistrictId}
            recs={recs}
          />
        </div>
      }
      bottom={
        <ForecastChart
          hours={simulationResult.hours}
          loadMW={simulationResult.city.loadMW}
          capMW={simulationResult.city.capMW}
          selectedHour={selectedHour}
          onHourChange={setSelectedHour}
        />
      }
    />
  );
}
