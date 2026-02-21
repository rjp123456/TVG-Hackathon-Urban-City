import { CityParams, DistrictId, DistrictOverride, DistrictOverrides, DriverItem } from "@/types/city";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export const mean = (values: number[]) =>
  values.length ? values.reduce((acc, v) => acc + v, 0) / values.length : 0;

export const toPercent = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export const formatSigned = (value: number, digits = 1) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;

export const formatMoneyM = (value: number) => `$${value.toFixed(2)}M`;

export const stableKey = (input: unknown) => JSON.stringify(input);

export const emptyOverrides = (): DistrictOverrides => ({
  downtown: {},
  industrial: {},
  university: {},
  medical: {},
  eastside: {},
  north: {},
  south: {},
  waterfront: {},
});

export const districtHasOverrides = (override: DistrictOverride) =>
  (override.storageMWh ?? 0) > 0 ||
  (override.capBoostMW ?? 0) > 0 ||
  (override.solarBoost ?? 0) > 0 ||
  Boolean(override.drEnabled);

export const countInterventions = (overrides: DistrictOverrides) =>
  (Object.keys(overrides) as DistrictId[]).filter((id) => districtHasOverrides(overrides[id])).length;

export const computeBudgetUsed = (params: CityParams, overrides: DistrictOverrides) => {
  let used = 0;

  if (params.microgridEnabled) used += 1.5;
  if (params.demandResponseEnabled) used += 0.2;

  for (const id of Object.keys(overrides) as DistrictId[]) {
    const o = overrides[id];
    used += (o.storageMWh ?? 0) * 0.6;
    used += ((o.capBoostMW ?? 0) / 10) * 0.35;
    used += ((o.solarBoost ?? 0) / 0.1) * 0.25;
    if (o.drEnabled) used += 0.2;
  }

  return Number(used.toFixed(3));
};

export const canAffordChange = (budgetM: number, usedM: number, deltaCostM: number) =>
  usedM + deltaCostM <= budgetM + 1e-9;

export const buildDistrictDrivers = (args: {
  baseMW: number;
  evMW: number;
  acMW: number;
  eventMW: number;
  solarMW: number;
  storageShaveMW: number;
}) => {
  const solarDrop = Math.max(0, args.baseMW * 0.2 - args.solarMW);

  const candidates: DriverItem[] = [
    { label: "EV evening surge", valueMW: args.evMW, tone: "up" },
    { label: "Heatwave AC load", valueMW: args.acMW, tone: "up" },
    { label: "Event demand spike", valueMW: args.eventMW, tone: "up" },
    { label: "Solar drop-off", valueMW: solarDrop, tone: "up" },
    { label: "Storage peak shave", valueMW: args.storageShaveMW, tone: "down" },
  ];

  return candidates
    .filter((d) => d.valueMW > 0.01)
    .sort((a, b) => b.valueMW - a.valueMW)
    .slice(0, 3);
};
