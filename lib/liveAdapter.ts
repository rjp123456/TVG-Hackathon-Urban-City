import { ErcotLiveBundle, LiveInputs, SimulationResult } from "@/types/city";
import { clamp } from "@/lib/utils";

const HOURS = 73;

const fillTo73 = (input: number[], fallback = 0) => {
  if (input.length >= HOURS) return input.slice(0, HOURS);
  if (!input.length) return Array.from({ length: HOURS }, () => fallback);
  const out = input.slice();
  while (out.length < HOURS) out.push(out[out.length - 1]);
  return out;
};

const mapByHour = (points: Array<{ hourISO: string; value: number }>) => {
  const map = new Map<number, number[]>();
  for (const p of points) {
    const h = new Date(p.hourISO).getTime();
    const slot = Math.floor(h / 3600000);
    const arr = map.get(slot) ?? [];
    arr.push(p.value);
    map.set(slot, arr);
  }
  return map;
};

const toHourlyCurve = (points: Array<{ hourISO: string; value: number }>, startISO: string) => {
  const byHour = mapByHour(points);
  const startSlot = Math.floor(new Date(startISO).getTime() / 3600000);
  return Array.from({ length: HOURS }, (_, i) => {
    const values = byHour.get(startSlot + i) ?? [];
    if (!values.length) return NaN;
    return values.reduce((a, b) => a + b, 0) / values.length;
  });
};

const fillNan = (curve: number[], fallback: number) => {
  const out = curve.slice();
  for (let i = 0; i < out.length; i += 1) {
    if (Number.isFinite(out[i])) continue;
    out[i] = i > 0 ? out[i - 1] : fallback;
  }
  return out;
};

export const toLiveInputs = (bundle: ErcotLiveBundle, dummy: SimulationResult): LiveInputs | null => {
  if (!bundle.forecast72h?.points?.length) return null;

  const startISO = bundle.forecast72h.points[0].hourISO;
  const systemDemand = fillNan(
    toHourlyCurve(bundle.forecast72h.points.map((p) => ({ hourISO: p.hourISO, value: p.demandMW })), startISO),
    bundle.realtime?.systemDemandMW ?? 45000,
  );

  const cityPeakDummyMW = Math.max(...dummy.city.loadMW);
  const systemPeak = Math.max(...systemDemand, 1);
  const scale = cityPeakDummyMW / systemPeak;

  const demandCurveMW = fillTo73(systemDemand.map((v) => Math.max(1, v * scale)));

  const outaged = bundle.outages72h?.points?.length
    ? fillNan(
        toHourlyCurve(bundle.outages72h.points.map((p) => ({ hourISO: p.hourISO, value: p.outagedMW })), startISO),
        0,
      )
    : Array.from({ length: HOURS }, () => 0);

  const realtimeCap = bundle.realtime?.systemCapacityMW ?? 0;
  const baseCapCity = realtimeCap > 0 ? realtimeCap * scale * 1.02 : Math.max(...demandCurveMW) / 0.78;

  const capacityCurveMW = fillTo73(
    demandCurveMW.map((d, i) => {
      const fromOutage = baseCapCity - outaged[i] * scale * 0.18;
      const fallback = d / 0.78;
      return Math.max(1, Number.isFinite(fromOutage) ? fromOutage : fallback);
    }),
  );

  const windNow = bundle.realtime?.windMW ?? 0;
  const solarNow = bundle.realtime?.solarMW ?? 0;
  const renewablesCurve = {
    windMW: fillTo73(Array.from({ length: HOURS }, () => windNow * scale)),
    solarMW: fillTo73(
      Array.from({ length: HOURS }, (_, i) => {
        const dayFrac = (i % 24) / 24;
        const shaped = Math.max(0, Math.sin(Math.PI * dayFrac)) ** 1.4;
        return Math.max(0, solarNow * scale * (0.4 + shaped));
      }),
    ),
  };

  const carbonIntensityCurve = fillTo73(
    demandCurveMW.map((load, i) => {
      const solarShare = renewablesCurve.solarMW[i] / Math.max(1, load);
      const windShare = renewablesCurve.windMW[i] / Math.max(1, load);
      return clamp(380 - 140 * (solarShare + windShare), 180, 520);
    }),
  );

  const hourlyPrices = bundle.prices?.points?.length
    ? fillNan(
        toHourlyCurve(
          bundle.prices.points
            .filter((p) => p.settlementPoint === "LZ_SOUTH")
            .map((p) => ({ hourISO: p.intervalISO, value: p.price })),
          startISO,
        ),
        30,
      )
    : null;

  const minP = hourlyPrices ? Math.min(...hourlyPrices) : 10;
  const maxP = hourlyPrices ? Math.max(...hourlyPrices) : 90;

  const costIndexCurve = fillTo73(
    demandCurveMW.map((_, i) => {
      if (hourlyPrices) {
        const n = (hourlyPrices[i] - minP) / Math.max(1, maxP - minP);
        return clamp(0.75 + n * 1.45, 0.75, 2.2);
      }
      const util = demandCurveMW[i] / Math.max(1, capacityCurveMW[i]);
      return clamp(1 + 0.55 * util ** 2, 0.75, 2.2);
    }),
  );

  return {
    liveMode: true,
    liveLabel: "Austin (proxy: LZ_SOUTH)",
    fetchedAtISO: bundle.fetchedAtISO,
    demandCurveMW,
    capacityCurveMW,
    renewablesCurve,
    carbonIntensityCurve,
    costIndexCurve,
  };
};
