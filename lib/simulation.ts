import { districts } from "@/lib/cityData";
import { clamp, mean, sigmoid } from "@/lib/utils";
import { CityParams, District, DistrictId, SimulationResult } from "@/types/city";

const HOURS = Array.from({ length: 73 }, (_, i) => i);
const TWO_PI = Math.PI * 2;
const PEAK_SIGMA = 0.06;

const dayFrac = (t: number) => (t % 24) / 24;

const eveningPeakCurve = (t: number) => {
  const d = dayFrac(t);
  const exponent = -((d - 0.75) ** 2) / (2 * PEAK_SIGMA ** 2);
  return Math.exp(exponent);
};

const temperatureFactor = (t: number, params: CityParams) => {
  const d = dayFrac(t);
  let baseline = 1.0 + 0.1 * Math.sin(TWO_PI * (d - 0.25));
  if (params.heatwaveEnabled) {
    baseline *= 1.12;
    const afternoonPulse = Math.exp(-((d - 0.7) ** 2) / (2 * 0.07 ** 2));
    baseline += 0.06 * afternoonPulse;
  }
  return clamp(baseline, 0.95, 1.25);
};

const solarCurve = (t: number, params: CityParams) => {
  const d = dayFrac(t);
  let solar = Math.max(0, Math.sin(Math.PI * d)) ** 1.5;
  if (params.stormEnabled) solar *= 0.55;
  return clamp(solar, 0, 1);
};

const randLike = (t: number, district: District) => {
  const input = `${district.id}-${t}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
};

const evChargingLoad = (district: District, t: number, params: CityParams) => {
  const baseEV = clamp(district.evAdoption + params.evAdoptionDelta, 0, 0.9);
  let evMW = (baseEV * district.population) / 1000 * 0.22;
  let evening = 0.35 + 0.95 * eveningPeakCurve(t);
  if (params.demandResponseEnabled) evening *= 0.82;
  evMW *= evening;
  return Math.max(0, evMW);
};

const acLoad = (district: District, t: number, params: CityParams) => {
  const acMW = district.baseLoadMW * 0.18 * (temperatureFactor(t, params) - 0.92);
  return Math.max(0, acMW * district.sensitivity.heat);
};

const eventSpike = (district: District, t: number, params: CityParams) => {
  if (!params.eventEnabled || district.id !== "downtown") return 0;
  const hour = t % 24;
  if (hour >= 18 && hour <= 22) return 22 * district.sensitivity.event;
  return 0;
};

const baseLoadTimeVariation = (district: District, t: number, params: CityParams) => {
  const d = dayFrac(t);
  const base =
    district.baseLoadMW *
    (0.92 + 0.1 * Math.sin(TWO_PI * (d - 0.2)) + 0.06 * eveningPeakCurve(t));
  return base * (params.stormEnabled ? 1.02 : 1);
};

const solarOffset = (district: District, t: number, params: CityParams) => {
  const solarPen = clamp(district.solarPenetration + params.solarDelta, 0, 0.85);
  return solarPen * district.baseLoadMW * 0.55 * solarCurve(t, params);
};

const capacityEffective = (district: District, t: number, params: CityParams) => {
  let cap = district.baseCapacityMW;
  if (params.stormEnabled) {
    const stormFactor = district.id === "waterfront" ? 0.78 : 0.9;
    cap *= stormFactor * (1.0 - 0.05 * randLike(t, district));
  }
  if (params.microgridEnabled && (district.id === "medical" || district.id === "downtown")) {
    cap += 18;
  }
  return cap;
};

const storagePeakShave = (
  params: CityParams,
  district: District,
  t: number,
  _preliminaryTotalLoad: number,
) => {
  const peak = eveningPeakCurve(t);
  if (peak <= 0.55 || params.storageMWh <= 0) return 0;
  const maxShaveMW = params.storageMWh * 6.0;
  const districtWeight = district.id === "medical" || district.id === "downtown" ? 1.25 : 0.85;
  return maxShaveMW * peak * districtWeight * 0.12;
};

export const runSimulation = (params: CityParams): SimulationResult => {
  const perDistrict = Object.fromEntries(
    districts.map((d) => [
      d.id,
      {
        loadMW: [] as number[],
        capMW: [] as number[],
        stress: [] as number[],
        prob: [] as number[],
        solarMW: [] as number[],
      },
    ]),
  ) as SimulationResult["perDistrict"];

  const cityLoadMW: number[] = [];
  const cityCapMW: number[] = [];
  const carbonIntensity: number[] = [];

  for (const t of HOURS) {
    let totalLoad = 0;
    let totalCap = 0;
    let totalSolar = 0;

    for (const district of districts) {
      const base = baseLoadTimeVariation(district, t, params);
      const ev = evChargingLoad(district, t, params);
      const ac = acLoad(district, t, params);
      const event = eventSpike(district, t, params);
      const solar = solarOffset(district, t, params);
      const prelim = base + ev + ac + event - solar;
      const shave = storagePeakShave(params, district, t, prelim);
      const load = Math.max(0, prelim - shave);
      const cap = capacityEffective(district, t, params);
      const stress = cap > 0 ? load / cap : 1.2;
      const margin = stress - 0.85;
      const prob = clamp(sigmoid(margin * 8) + 0.05 * district.criticality, 0, 1);

      perDistrict[district.id].loadMW.push(load);
      perDistrict[district.id].capMW.push(cap);
      perDistrict[district.id].stress.push(stress);
      perDistrict[district.id].prob.push(prob);
      perDistrict[district.id].solarMW.push(solar);

      totalLoad += load;
      totalCap += cap;
      totalSolar += solar;
    }

    cityLoadMW.push(totalLoad);
    cityCapMW.push(totalCap);
    const baseCI = 380;
    const rawCI = baseCI - 140 * (totalSolar / Math.max(1, totalLoad)) + (params.stormEnabled ? 30 : 0);
    carbonIntensity.push(clamp(rawCI, 180, 520));
  }

  const peakLoad = Math.max(...cityLoadMW);
  const peakHour = cityLoadMW.findIndex((v) => v === peakLoad);

  const stressesAtPeak = districts.map((d) => clamp(perDistrict[d.id].stress[peakHour], 0, 1.2));
  const overloadZones = districts
    .filter((d) => perDistrict[d.id].stress[peakHour] > 1)
    .map((d) => d.id as DistrictId);

  const topRisk = districts
    .map((d) => ({
      id: d.id as DistrictId,
      stress: perDistrict[d.id].stress[peakHour],
      prob: perDistrict[d.id].prob[peakHour],
    }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 3);

  const avgStress = mean(stressesAtPeak);
  const scoreRaw =
    100 -
    55 * avgStress -
    12 * overloadZones.length +
    6 * params.storageMWh +
    (params.microgridEnabled ? 6 : 0) +
    (params.demandResponseEnabled ? 4 : 0);

  return {
    hours: HOURS,
    perDistrict,
    city: {
      loadMW: cityLoadMW,
      capMW: cityCapMW,
      carbonIntensity,
      peakHour,
      peakLoad,
    },
    summaryAtHour: {
      hour: peakHour,
      overloadZones,
      topRisk,
    },
    resilienceScore: Math.round(clamp(scoreRaw, 0, 100)),
  };
};
