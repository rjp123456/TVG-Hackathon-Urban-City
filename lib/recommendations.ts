import { districts } from "@/lib/cityData";
import { toPercent } from "@/lib/utils";
import { CityParams, RecommendationOutput, SimulationResult } from "@/types/city";

export const buildRecommendations = (
  result: SimulationResult,
  params: CityParams,
  baseline?: SimulationResult,
): RecommendationOutput => {
  const peakHour = result.city.peakHour;
  const topRisk = result.summaryAtHour.topRisk[0];

  const riskFeed: RecommendationOutput["riskFeed"] = [];
  if (topRisk && topRisk.stress > 1) {
    riskFeed.push({
      type: "warn",
      text: `⚠ ${districts.find((d) => d.id === topRisk.id)?.name ?? topRisk.id} projected overload at T+${peakHour}h (Stress ${topRisk.stress.toFixed(2)}).`,
    });
  } else {
    riskFeed.push({
      type: "ok",
      text: `System stable at projected peak (T+${peakHour}h) with no hard overloads detected.`,
    });
  }

  const middayHours = [11, 12, 13, 14].map((h) => h + 24);
  const middaySolar = middayHours.reduce(
    (acc, h) =>
      acc + districts.reduce((sum, d) => sum + result.perDistrict[d.id].solarMW[h], 0),
    0,
  );
  const middayLoad = middayHours.reduce((acc, h) => acc + result.city.loadMW[h], 0);
  const solarPct = middayLoad > 0 ? (middaySolar / middayLoad) * 100 : 0;

  riskFeed.push({
    type: "info",
    text: `☀ Solar offsets ${solarPct.toFixed(1)}% of midday demand under this scenario.`,
  });

  if (params.stormEnabled) {
    riskFeed.push({
      type: "warn",
      text: `Storm mode de-rates feeder capacity and suppresses solar availability across vulnerable zones.`,
    });
  } else {
    riskFeed.push({
      type: "ok",
      text: `Grid inertia remains healthy with balanced thermal and renewable contribution.`,
    });
  }

  const actions: RecommendationOutput["actions"] = [];

  const peakRisk = result.summaryAtHour.topRisk.find((r) => r.prob > 0.65);
  if (peakRisk) {
    const districtName = districts.find((d) => d.id === peakRisk.id)?.name ?? peakRisk.id;
    const peakReduction = Math.max(4, params.storageMWh * 6.2);
    actions.push({
      title: `Deploy storage in ${districtName}`,
      rationale: "Peak risk exceeds threshold; shaving evening peak reduces overload probability.",
      impact: `Expected peak reduction: ~${peakReduction.toFixed(1)} MW; overload probability -${Math.min(35, peakRisk.prob * 35).toFixed(0)}%.`,
      confidence: "High",
    });
  }

  const peakDayHour = peakHour % 24;
  if (peakDayHour >= 18 && peakDayHour <= 22 && params.evAdoptionDelta >= 0.12) {
    actions.push({
      title: "Enable managed EV charging (6-9pm deferral)",
      rationale: "EV demand is concentrated in evening hours and is amplifying peak loading.",
      impact: "Expected evening net-load suppression: 6-12 MW across residential feeders.",
      confidence: "High",
    });
  }

  const avgSolarPen = districts.reduce((acc, d) => acc + d.solarPenetration + params.solarDelta, 0) / districts.length;
  const middayStress = middayHours.reduce(
    (acc, h) => acc + districts.reduce((s, d) => s + result.perDistrict[d.id].stress[h], 0) / districts.length,
    0,
  ) / middayHours.length;

  if (avgSolarPen < 0.25 && middayStress > 0.72) {
    actions.push({
      title: "Incentivize rooftop solar in Eastside and South Residential",
      rationale: "Distributed midday generation can flatten daytime thermal dispatch and protect evening ramp.",
      impact: "Modeled effect: 3-7% midday load offset and lower carbon intensity variance.",
      confidence: "Med",
    });
  }

  if (params.stormEnabled) {
    actions.push({
      title: "Activate microgrid failover for critical districts",
      rationale: "Storm conditions increase outage exposure for high-criticality service corridors.",
      impact: "Improves continuity for Medical District and Downtown while reducing overload spillover risk.",
      confidence: "High",
    });
  }

  const trimmedActions = actions.slice(0, 3);

  const baselinePeak = baseline?.city.peakLoad ?? result.city.peakLoad;
  const currentOverload = result.summaryAtHour.overloadZones.length;
  const baselineOverload = baseline?.summaryAtHour.overloadZones.length ?? currentOverload;
  const peakDelta = result.city.peakLoad - baselinePeak;
  const overloadDelta = currentOverload - baselineOverload;
  const resilienceDelta = result.resilienceScore - (baseline?.resilienceScore ?? result.resilienceScore);

  riskFeed.push({
    type: "info",
    text: `Drivers: ${params.heatwaveEnabled ? "heat stress" : "normal thermal profile"}, ${params.evAdoptionDelta > 0.08 ? "EV evening peak" : "controlled EV demand"}, ${params.stormEnabled ? "storm-related solar drop-off" : "stable solar curve"}.`,
  });

  return {
    riskFeed,
    actions: trimmedActions.length
      ? trimmedActions
      : [
          {
            title: "Maintain baseline dispatch posture",
            rationale: "Risk profile is within operational envelope with current intervention mix.",
            impact: "No urgent action required; continue monitoring peak-hour stress and reserve margin.",
            confidence: "Med",
          },
        ],
    impactSummary: {
      peakDelta: Number(peakDelta.toFixed(1)),
      overloadDelta,
      resilienceDelta: Number(resilienceDelta.toFixed(1)),
    },
  };
};

export const formatImpact = (value: number, unit: string) => {
  const abs = Math.abs(value).toFixed(1);
  return `${value >= 0 ? "+" : "-"}${abs}${unit}`;
};

export const formatOverloadDelta = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

export const formatResilienceDelta = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(0)} pts`;

export const formatFeedPercent = (value: number) => toPercent(value, 1);
