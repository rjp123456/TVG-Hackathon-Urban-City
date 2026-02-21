export type DistrictId =
  | "downtown"
  | "industrial"
  | "university"
  | "medical"
  | "eastside"
  | "north"
  | "south"
  | "waterfront";

export type District = {
  id: DistrictId;
  name: string;
  q: number;
  r: number;
  baseLoadMW: number;
  baseCapacityMW: number;
  population: number;
  evAdoption: number;
  solarPenetration: number;
  criticality: number;
  sensitivity: {
    heat: number;
    storm: number;
    event: number;
  };
};

export type DistrictOverride = {
  storageMWh?: number;
  capBoostMW?: number;
  drEnabled?: boolean;
  solarBoost?: number;
  evBoost?: number;
};

export type DistrictOverrides = Record<DistrictId, DistrictOverride>;

export type LiveInputs = {
  liveMode: true;
  liveLabel: string;
  fetchedAtISO: string;
  demandCurveMW: number[];
  capacityCurveMW: number[];
  renewablesCurve: { windMW: number[]; solarMW: number[] } | null;
  carbonIntensityCurve: number[];
  costIndexCurve: number[];
};

export type ErcotForecastPoint = { hourISO: string; demandMW: number };
export type ErcotOutagePoint = { hourISO: string; outagedMW: number };
export type ErcotPricePoint = { intervalISO: string; settlementPoint: string; price: number };

export type ErcotLiveBundle = {
  ok: boolean;
  fetchedAtISO: string;
  austinProxy: { loadZone: "LZ_SOUTH"; hub: "HB_SOUTH" };
  realtime?: {
    timestampISO: string;
    systemDemandMW: number;
    systemCapacityMW: number;
    windMW: number;
    solarMW: number;
  };
  forecast72h?: { timestampISO: string; points: ErcotForecastPoint[] };
  outages72h?: { timestampISO: string; loadZone: string; points: ErcotOutagePoint[] };
  prices?: { timestampISO: string; points: ErcotPricePoint[] };
  errors?: string[];
};

export type CityParams = {
  evAdoptionDelta: number;
  solarDelta: number;
  storageMWh: number;
  microgridEnabled: boolean;
  demandResponseEnabled: boolean;
  heatwaveEnabled: boolean;
  stormEnabled: boolean;
  eventEnabled: boolean;
  criticalPriorityEnabled: boolean;
  budgetM: number;
};

export type ScenarioKey = "baseline" | "heatwaveEvSurge" | "stormStress" | "greenUpgrade";

export type ScenarioPreset = {
  name: string;
  params: Omit<CityParams, "budgetM">;
};

export type PerDistrictSeries = {
  loadMW: number[];
  capMW: number[];
  stress: number[];
  prob: number[];
};

export type DistrictComponentPoint = {
  baseMW: number;
  evMW: number;
  acMW: number;
  eventMW: number;
  solarMW: number;
  storageShaveMW: number;
  capMW: number;
};

export type AlertPoint = {
  hour: number;
  level: "warn" | "crit";
  districtId: DistrictId;
  prob: number;
  stress: number;
};

export type CompareSummary = {
  peakDeltaMW: number;
  overloadDelta: number;
  resilienceDelta: number;
  carbonDelta: number;
  costSavingsPct: number;
};

export type SimulationResult = {
  hours: number[];
  perDistrict: Record<DistrictId, PerDistrictSeries>;
  perDistrictComponents: Record<DistrictId, DistrictComponentPoint[]>;
  city: {
    loadMW: number[];
    capMW: number[];
    totalSolarMW: number[];
    carbonIntensity: number[];
    costIndex: number[];
    peakHour: number;
    peakLoad: number;
  };
  alertHours: AlertPoint[];
  summaryAtPeak: {
    hour: number;
    overloadZones: DistrictId[];
    topRisk: Array<{ id: DistrictId; stress: number; prob: number }>;
  };
  resilienceScore: number;
};

export type RiskFeedItem = {
  type: "warn" | "info" | "ok";
  text: string;
};

export type ActionImpact = {
  peakLoadDeltaMW: number;
  overloadDelta: number;
  peakRiskDelta: number;
  resilienceDelta: number;
  carbonDelta: number;
  costDelta: number;
  costSavingsPct: number;
};

export type ActionItem = {
  id: string;
  title: string;
  rationale: string;
  drivers: string;
  confidence: "High" | "Med" | "Low";
  impact: ActionImpact;
  costM: number;
  overBudget: boolean;
  bestBangForBuck?: boolean;
};

export type RecommendationOutput = {
  riskFeed: RiskFeedItem[];
  actions: ActionItem[];
  compare: CompareSummary;
};

export type DriverItem = {
  label: string;
  valueMW: number;
  tone: "up" | "down";
};
