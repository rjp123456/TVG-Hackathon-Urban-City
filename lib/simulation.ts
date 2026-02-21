import { districts } from "@/lib/cityData";
import { clamp, emptyOverrides, mean, sigmoid } from "@/lib/utils";
import {
  CityParams,
  District,
  DistrictId,
  DistrictOverrides,
  SimulationResult,
} from "@/types/city";

const HOURS = Array.from({ length: 73 }, (_, i) => i);
const TWO_PI = Math.PI * 2;

const dayFrac = (t: number) => (t % 24) / 24;

export const eveningPeakCurve = (t: number) => {
  const d = dayFrac(t);
  return Math.exp(-((d - 0.75) ** 2) / (2 * 0.06 ** 2));
};

const temperatureFactor = (t: number, params: CityParams) => {
  const d = dayFrac(t);
  let base = 1.0 + 0.1 * Math.sin(TWO_PI * (d - 0.25));
  if (params.heatwaveEnabled) {
    base *= 1.12;
    base += 0.06 * Math.exp(-((d - 0.65) ** 2) / (2 * 0.08 ** 2));
  }
  return clamp(base, 0.95, 1.3);
};

const solarCurve = (t: number, params: CityParams) => {
  let solar = Math.max(0, Math.sin(Math.PI * dayFrac(t))) ** 1.5;
  if (params.stormEnabled) solar *= 0.55;
  return clamp(solar, 0, 1);
};

const randLike = (t: number, districtId: DistrictId) => {
  const str = `${districtId}:${t}`;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const baseLoadTimeVariation = (d: District, t: number, params: CityParams) => {
  const base =
    d.baseLoadMW *
    (0.92 + 0.1 * Math.sin(TWO_PI * (dayFrac(t) - 0.2)) + 0.06 * eveningPeakCurve(t));
  return params.stormEnabled ? base * 1.02 : base;
};

const evLoad = (d: District, t: number, params: CityParams, localDrEnabled: boolean) => {
  const ev = clamp(d.evAdoption + params.evAdoptionDelta, 0, 0.9);
  const baseMW = ((ev * d.population) / 1000) * 0.22;
  const peak = eveningPeakCurve(t);
  let shaped = baseMW * (0.35 + 0.95 * peak);
  if (params.demandResponseEnabled || localDrEnabled) {
    shaped *= 1 - 0.18 * peak;
  }
  return shaped;
};

const acLoad = (d: District, t: number, params: CityParams) =>
  d.baseLoadMW * 0.18 * Math.max(0, temperatureFactor(t, params) - 0.92) * d.sensitivity.heat;

const eventSpike = (d: District, t: number, params: CityParams) => {
  const h = t % 24;
  if (params.eventEnabled && d.id === "downtown" && h >= 18 && h <= 22) {
    return 22 * d.sensitivity.event;
  }
  return 0;
};

const capacityEffective = (
  d: District,
  t: number,
  params: CityParams,
  capBoostMW: number,
) => {
  let cap = d.baseCapacityMW;
  if (params.stormEnabled) {
    cap *= d.id === "waterfront" ? 0.78 : 0.9;
    cap *= 1 - 0.05 * randLike(t, d.id);
  }
  if (params.microgridEnabled && (d.id === "medical" || d.id === "downtown")) cap += 18;
  cap += capBoostMW;
  return Math.max(1, cap);
};

const buildGlobalStorageShares = (params: CityParams, overrides: DistrictOverrides) => {
  const eligible = districts.filter((d) => !(overrides[d.id].storageMWh && overrides[d.id].storageMWh! > 0));
  const weights = Object.fromEntries(
    eligible.map((d) => [
      d.id,
      params.criticalPriorityEnabled && (d.id === "medical" || d.id === "downtown") ? 1.25 : 0.85,
    ]),
  ) as Record<DistrictId, number>;

  const sum = eligible.reduce((acc, d) => acc + weights[d.id], 0) || 1;
  const shares = Object.fromEntries(districts.map((d) => [d.id, 0])) as Record<DistrictId, number>;
  for (const d of eligible) shares[d.id] = weights[d.id] / sum;
  return shares;
};

const storageShave = (
  d: District,
  t: number,
  params: CityParams,
  overrides: DistrictOverrides,
  globalShares: Record<DistrictId, number>,
) => {
  const peak = eveningPeakCurve(t);
  if (peak <= 0.55) return 0;

  const localStorage = overrides[d.id].storageMWh ?? 0;
  if (localStorage > 0) {
    const weight = params.criticalPriorityEnabled && (d.id === "medical" || d.id === "downtown") ? 1.25 : 1;
    return localStorage * 6.0 * peak * weight * 0.2;
  }

  if (params.storageMWh <= 0) return 0;
  return params.storageMWh * 6.0 * peak * globalShares[d.id] * 0.95;
};

export const runSimulation = (
  params: CityParams,
  inputOverrides?: DistrictOverrides,
): SimulationResult => {
  const overrides = inputOverrides ?? emptyOverrides();

  const perDistrict = Object.fromEntries(
    districts.map((d) => [
      d.id,
      { loadMW: [] as number[], capMW: [] as number[], stress: [] as number[], prob: [] as number[] },
    ]),
  ) as SimulationResult["perDistrict"];

  const perDistrictComponents = Object.fromEntries(
    districts.map((d) => [d.id, [] as SimulationResult["perDistrictComponents"][DistrictId]]),
  ) as SimulationResult["perDistrictComponents"];

  const cityLoadMW: number[] = [];
  const cityCapMW: number[] = [];
  const totalSolarMW: number[] = [];
  const carbonIntensity: number[] = [];
  const costIndex: number[] = [];

  const globalShares = buildGlobalStorageShares(params, overrides);

  for (const t of HOURS) {
    let cityLoad = 0;
    let cityCap = 0;
    let solarSum = 0;
    let localDrCount = 0;

    for (const d of districts) {
      const o = overrides[d.id];
      const localDr = Boolean(o.drEnabled);
      if (localDr) localDrCount += 1;

      const baseMW = baseLoadTimeVariation(d, t, params);
      const evMW = evLoad(d, t, params, localDr);
      const acMW = acLoad(d, t, params);
      const eventMW = eventSpike(d, t, params);

      const solarPen = clamp(d.solarPenetration + params.solarDelta + (o.solarBoost ?? 0), 0, 0.85);
      const solarMW = solarPen * d.baseLoadMW * 0.55 * solarCurve(t, params);

      const storageShaveMW = storageShave(d, t, params, overrides, globalShares);
      const capMW = capacityEffective(d, t, params, o.capBoostMW ?? 0);

      const loadMW = Math.max(0, baseMW + evMW + acMW + eventMW - solarMW - storageShaveMW);
      const stress = loadMW / capMW;
      const prob = clamp(sigmoid((stress - 0.85) * 8) + 0.05 * d.criticality, 0, 1);

      perDistrict[d.id].loadMW.push(loadMW);
      perDistrict[d.id].capMW.push(capMW);
      perDistrict[d.id].stress.push(stress);
      perDistrict[d.id].prob.push(prob);
      perDistrictComponents[d.id].push({
        baseMW,
        evMW,
        acMW,
        eventMW,
        solarMW,
        storageShaveMW,
        capMW,
      });

      cityLoad += loadMW;
      cityCap += capMW;
      solarSum += solarMW;
    }

    cityLoadMW.push(cityLoad);
    cityCapMW.push(cityCap);
    totalSolarMW.push(solarSum);

    let ci = 380 - 140 * (solarSum / Math.max(1, cityLoad));
    if (params.stormEnabled) ci += 30;
    if (params.heatwaveEnabled) ci += 15;
    carbonIntensity.push(clamp(ci, 180, 520));

    const peakPremium = 0.55 * (cityLoad / Math.max(1, cityCap)) ** 2;
    const drCoverage = params.demandResponseEnabled ? 1 : localDrCount / districts.length;
    const drDiscount = -0.1 * eveningPeakCurve(t) * drCoverage;
    const solarDiscount = -0.08 * (solarSum / Math.max(1, cityLoad));
    costIndex.push(clamp(1 + peakPremium + drDiscount + solarDiscount, 0.75, 2.2));
  }

  const peakLoad = Math.max(...cityLoadMW);
  const peakHour = cityLoadMW.findIndex((v) => v === peakLoad);

  const overloadZones = districts
    .filter((d) => perDistrict[d.id].stress[peakHour] > 1.0)
    .map((d) => d.id as DistrictId);

  const topRisk = districts
    .map((d) => ({
      id: d.id as DistrictId,
      stress: perDistrict[d.id].stress[peakHour],
      prob: perDistrict[d.id].prob[peakHour],
    }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 3);

  const alertHours: SimulationResult["alertHours"] = [];
  for (const t of HOURS) {
    const worst = districts
      .map((d) => ({
        districtId: d.id as DistrictId,
        prob: perDistrict[d.id].prob[t],
        stress: perDistrict[d.id].stress[t],
      }))
      .sort((a, b) => b.prob - a.prob)[0];

    if (!worst) continue;
    if (worst.prob > 0.8 || worst.stress > 1.0) {
      alertHours.push({ hour: t, level: "crit", ...worst });
    } else if (worst.prob > 0.65) {
      alertHours.push({ hour: t, level: "warn", ...worst });
    }
  }

  const avgStressAtPeak = mean(districts.map((d) => clamp(perDistrict[d.id].stress[peakHour], 0, 1.2)));
  const resilienceScore = Math.round(
    clamp(
      100 -
        55 * avgStressAtPeak -
        12 * overloadZones.length +
        6 * params.storageMWh +
        (params.microgridEnabled ? 6 : 0) +
        (params.demandResponseEnabled ? 4 : 0),
      0,
      100,
    ),
  );

  return {
    hours: HOURS,
    perDistrict,
    perDistrictComponents,
    city: {
      loadMW: cityLoadMW,
      capMW: cityCapMW,
      totalSolarMW,
      carbonIntensity,
      costIndex,
      peakHour,
      peakLoad,
    },
    alertHours,
    summaryAtPeak: {
      hour: peakHour,
      overloadZones,
      topRisk,
    },
    resilienceScore,
  };
};
