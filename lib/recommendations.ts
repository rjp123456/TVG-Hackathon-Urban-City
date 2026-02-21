import { districts } from "@/lib/cityData";
import { runSimulation } from "@/lib/simulation";
import {
  canAffordChange,
  clamp,
  computeBudgetUsed,
  formatSigned,
  stableKey,
  toPercent,
} from "@/lib/utils";
import {
  ActionItem,
  CityParams,
  DistrictId,
  DistrictOverrides,
  RecommendationOutput,
  SimulationResult,
} from "@/types/city";

type CandidateAction = {
  id: string;
  title: string;
  rationale: string;
  drivers: string;
  costM: number;
  apply: (params: CityParams, overrides: DistrictOverrides, worstDistrictId: DistrictId) => {
    params: CityParams;
    overrides: DistrictOverrides;
  };
};

const cloneOverrides = (overrides: DistrictOverrides): DistrictOverrides =>
  JSON.parse(JSON.stringify(overrides)) as DistrictOverrides;

export const identifyWorstDistrict = (result: SimulationResult, hour = result.city.peakHour) =>
  districts
    .map((d) => ({ id: d.id as DistrictId, prob: result.perDistrict[d.id].prob[hour] }))
    .sort((a, b) => b.prob - a.prob)[0].id;

const topLoadDistricts = (result: SimulationResult) => {
  const hour = result.city.peakHour;
  return districts
    .map((d) => ({ id: d.id as DistrictId, load: result.perDistrict[d.id].loadMW[hour] }))
    .sort((a, b) => b.load - a.load)
    .slice(0, 2)
    .map((d) => d.id);
};

export const generateCandidateActions = (
  params: CityParams,
  overrides: DistrictOverrides,
  worstDistrictId: DistrictId,
  result: SimulationResult,
): CandidateAction[] => {
  const candidates: CandidateAction[] = [
    {
      id: "storage-worst",
      title: `Add +1.5 MWh battery in ${districts.find((d) => d.id === worstDistrictId)?.name ?? worstDistrictId}`,
      rationale: "Targets peak-hour stress where overload probability is highest.",
      drivers: "Evening ramp and localized peak pressure",
      costM: 0.9,
      apply: (p, o, worst) => {
        const nextO = cloneOverrides(o);
        nextO[worst].storageMWh = clamp((nextO[worst].storageMWh ?? 0) + 1.5, 0, 5);
        return { params: { ...p }, overrides: nextO };
      },
    },
    {
      id: "dr-enable",
      title: params.demandResponseEnabled
        ? `Enable local DR in ${districts.find((d) => d.id === worstDistrictId)?.name ?? worstDistrictId}`
        : "Enable global managed demand response",
      rationale: "Defers EV charging during 6-9pm to flatten feeder spikes.",
      drivers: "EV evening concentration",
      costM: 0.2,
      apply: (p, o, worst) => {
        if (!p.demandResponseEnabled) return { params: { ...p, demandResponseEnabled: true }, overrides: cloneOverrides(o) };
        const nextO = cloneOverrides(o);
        nextO[worst].drEnabled = true;
        return { params: { ...p }, overrides: nextO };
      },
    },
    {
      id: "capacity-worst",
      title: `Upgrade transformer +10 MW in ${districts.find((d) => d.id === worstDistrictId)?.name ?? worstDistrictId}`,
      rationale: "Adds immediate headroom in the most constrained district.",
      drivers: "Transformer loading margin",
      costM: 0.35,
      apply: (p, o, worst) => {
        const nextO = cloneOverrides(o);
        nextO[worst].capBoostMW = (nextO[worst].capBoostMW ?? 0) + 10;
        return { params: { ...p }, overrides: nextO };
      },
    },
    {
      id: "solar-top2",
      title: "Incentivize +10% rooftop solar in top load districts",
      rationale: "Cuts midday thermal dispatch and lowers evening ramp burden.",
      drivers: "Solar offset and carbon pressure",
      costM: 0.5,
      apply: (p, o) => {
        const top2 = topLoadDistricts(result);
        const nextO = cloneOverrides(o);
        for (const id of top2) {
          nextO[id].solarBoost = (nextO[id].solarBoost ?? 0) + 0.1;
        }
        return { params: { ...p }, overrides: nextO };
      },
    },
  ];

  return candidates;
};

const overloadCountAtPeak = (result: SimulationResult) => result.summaryAtPeak.overloadZones.length;
const peakRisk = (result: SimulationResult) => Math.max(...districts.map((d) => result.perDistrict[d.id].prob[result.city.peakHour]));

const actionScore = (impact: ActionItem["impact"]) =>
  impact.resilienceDelta * 1.0 +
  (-impact.overloadDelta > 0 ? -impact.overloadDelta * 12 : 0) +
  (-impact.peakLoadDeltaMW * 0.12) +
  (-impact.peakRiskDelta * 30) +
  (impact.costSavingsPct * 0.5);

const confidenceFromImpact = (impact: ActionItem["impact"]) => {
  if (impact.resilienceDelta >= 8 || impact.overloadDelta <= -1 || impact.peakRiskDelta <= -0.12) return "High";
  return "Med";
};

export const runCounterfactuals = (args: {
  resultA: SimulationResult;
  resultB: SimulationResult;
  paramsB: CityParams;
  overridesB: DistrictOverrides;
  selectedHour: number;
}) => {
  const { resultA, resultB, paramsB, overridesB, selectedHour } = args;
  const worstDistrictId = identifyWorstDistrict(resultB, selectedHour);
  const baseOverloads = overloadCountAtPeak(resultB);
  const basePeakRisk = peakRisk(resultB);
  const basePeakHour = resultB.city.peakHour;
  const budgetUsed = computeBudgetUsed(paramsB, overridesB);

  const candidates = generateCandidateActions(paramsB, overridesB, worstDistrictId, resultB).slice(0, 4);

  const evaluated: ActionItem[] = candidates.map((candidate) => {
    const next = candidate.apply(paramsB, overridesB, worstDistrictId);
    const simulated = runSimulation(next.params, next.overrides);

    const peakLoadDeltaMW = simulated.city.peakLoad - resultB.city.peakLoad;
    const overloadDelta = overloadCountAtPeak(simulated) - baseOverloads;
    const peakRiskDelta = peakRisk(simulated) - basePeakRisk;
    const resilienceDelta = simulated.resilienceScore - resultB.resilienceScore;
    const carbonDelta = simulated.city.carbonIntensity[simulated.city.peakHour] - resultB.city.carbonIntensity[basePeakHour];
    const costDelta = simulated.city.costIndex[simulated.city.peakHour] - resultB.city.costIndex[basePeakHour];
    const costSavingsPct =
      ((resultB.city.costIndex[basePeakHour] - simulated.city.costIndex[simulated.city.peakHour]) /
        Math.max(0.1, resultB.city.costIndex[basePeakHour])) *
      100;

    const impact: ActionItem["impact"] = {
      peakLoadDeltaMW: Number(peakLoadDeltaMW.toFixed(1)),
      overloadDelta,
      peakRiskDelta: Number(peakRiskDelta.toFixed(3)),
      resilienceDelta: Number(resilienceDelta.toFixed(1)),
      carbonDelta: Number(carbonDelta.toFixed(1)),
      costDelta: Number(costDelta.toFixed(3)),
      costSavingsPct: Number(costSavingsPct.toFixed(1)),
    };

    return {
      id: candidate.id,
      title: candidate.title,
      rationale: candidate.rationale,
      drivers: candidate.drivers,
      confidence: confidenceFromImpact(impact),
      impact,
      costM: candidate.costM,
      overBudget: !canAffordChange(paramsB.budgetM, budgetUsed, candidate.costM),
    };
  });

  const ranked = evaluated
    .slice()
    .sort((a, b) => actionScore(b.impact) - actionScore(a.impact))
    .slice(0, 3);

  const affordable = ranked.filter((a) => !a.overBudget);
  if (affordable.length) {
    const best = affordable
      .slice()
      .sort(
        (a, b) => actionScore(b.impact) / Math.max(0.1, b.costM) - actionScore(a.impact) / Math.max(0.1, a.costM),
      )[0];
    best.bestBangForBuck = true;
  }

  const peakA = resultA.city.peakHour;
  const peakB = resultB.city.peakHour;

  return {
    actions: ranked,
    compare: {
      peakDeltaMW: Number((resultB.city.peakLoad - resultA.city.peakLoad).toFixed(1)),
      overloadDelta: overloadCountAtPeak(resultB) - overloadCountAtPeak(resultA),
      resilienceDelta: resultB.resilienceScore - resultA.resilienceScore,
      carbonDelta: Number((resultB.city.carbonIntensity[peakB] - resultA.city.carbonIntensity[peakA]).toFixed(1)),
      costSavingsPct: Number(
        (
          ((resultA.city.costIndex[peakA] - resultB.city.costIndex[peakB]) /
            Math.max(0.1, resultA.city.costIndex[peakA])) *
          100
        ).toFixed(1),
      ),
    },
    worstDistrictId,
  };
};

export const buildRecommendations = (args: {
  resultA: SimulationResult;
  resultB: SimulationResult;
  paramsB: CityParams;
  overridesB: DistrictOverrides;
  selectedHour: number;
}): RecommendationOutput => {
  const { resultA, resultB, paramsB, overridesB, selectedHour } = args;
  const { actions, compare, worstDistrictId } = runCounterfactuals(args);

  const worstAtSelected = districts
    .map((d) => ({ id: d.id as DistrictId, prob: resultB.perDistrict[d.id].prob[selectedHour], stress: resultB.perDistrict[d.id].stress[selectedHour] }))
    .sort((a, b) => b.prob - a.prob)[0];

  const peakRiskDistrict = resultB.summaryAtPeak.topRisk[0];
  const middayHours = [11, 12, 13, 14].map((h) => h + 24);
  const solarOffsetPct =
    middayHours.reduce((acc, h) => acc + resultB.city.totalSolarMW[h], 0) /
    Math.max(1, middayHours.reduce((acc, h) => acc + resultB.city.loadMW[h], 0));

  const riskFeed: RecommendationOutput["riskFeed"] = [
    {
      type: worstAtSelected.prob > 0.75 || worstAtSelected.stress > 1 ? "warn" : "info",
      text: `T+${selectedHour}h worst zone: ${districts.find((d) => d.id === worstAtSelected.id)?.name} (Stress ${worstAtSelected.stress.toFixed(2)}, Risk ${(worstAtSelected.prob * 100).toFixed(0)}%).`,
    },
    {
      type: peakRiskDistrict.stress > 1 ? "warn" : "info",
      text: `Peak projection at T+${resultB.city.peakHour}h flags ${districts.find((d) => d.id === peakRiskDistrict.id)?.name} as top overload candidate.`,
    },
    {
      type: "ok",
      text: `Renewables offset ${(solarOffsetPct * 100).toFixed(1)}% of midday demand in Scenario B.`,
    },
  ];

  const peakCost = resultB.city.costIndex[resultB.city.peakHour];
  if (peakCost > 1.5) {
    riskFeed.push({
      type: "warn",
      text: `Cost pressure elevated at peak (Index ${peakCost.toFixed(2)}). Dispatch optimization advised.`,
    });
  }

  if (["medical", "downtown"].includes(worstDistrictId) && worstAtSelected.prob > 0.62) {
    riskFeed.push({
      type: "warn",
      text: `Critical infrastructure exposure detected in ${districts.find((d) => d.id === worstDistrictId)?.name}. Prioritize protective interventions.`,
    });
  }

  const used = computeBudgetUsed(paramsB, overridesB);
  riskFeed.push({
    type: "info",
    text: `Budget utilization ${used.toFixed(2)}M / ${paramsB.budgetM.toFixed(1)}M. ${used > paramsB.budgetM ? "Over allocation risk." : "Within approved cap."}`,
  });

  return { riskFeed, actions, compare };
};

export const actionImpactLine = (action: ActionItem) =>
  `Peak: ${formatSigned(action.impact.peakLoadDeltaMW, 1)} MW • Risk: ${formatSigned(action.impact.peakRiskDelta * 100, 1)}% • Resilience: ${formatSigned(action.impact.resilienceDelta, 0)}`;

export const compareLine = (compare: RecommendationOutput["compare"]) =>
  `Peak ${formatSigned(compare.peakDeltaMW, 1)} MW • Overloads ${formatSigned(compare.overloadDelta, 0)} • Resilience ${formatSigned(compare.resilienceDelta, 0)} • Cost ${formatSigned(compare.costSavingsPct, 1)}%`;

export const recommendationsKey = (params: CityParams, overrides: DistrictOverrides, selectedHour: number) =>
  stableKey({ params, overrides, selectedHour });

export const costChip = (action: ActionItem) => `${action.costM.toFixed(2)}M`;
export const riskLabel = (value: number) => toPercent(value, 0);
