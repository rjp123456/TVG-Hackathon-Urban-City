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

export type CityParams = {
  evAdoptionDelta: number;
  solarDelta: number;
  storageMWh: number;
  microgridEnabled: boolean;
  demandResponseEnabled: boolean;
  heatwaveEnabled: boolean;
  stormEnabled: boolean;
  eventEnabled: boolean;
};

export type ScenarioKey = "baseline" | "heatwaveEvSurge" | "stormStress" | "greenUpgrade";

export type ScenarioPreset = {
  name: string;
  params: CityParams;
};

export type PerDistrictSeries = {
  loadMW: number[];
  capMW: number[];
  stress: number[];
  prob: number[];
  solarMW: number[];
};

export type SimulationResult = {
  hours: number[];
  perDistrict: Record<DistrictId, PerDistrictSeries>;
  city: {
    loadMW: number[];
    capMW: number[];
    carbonIntensity: number[];
    peakHour: number;
    peakLoad: number;
  };
  summaryAtHour: {
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

export type ActionItem = {
  title: string;
  rationale: string;
  impact: string;
  confidence: "High" | "Med" | "Low";
};

export type RecommendationOutput = {
  riskFeed: RiskFeedItem[];
  actions: ActionItem[];
  impactSummary: {
    peakDelta: number;
    overloadDelta: number;
    resilienceDelta: number;
  };
};
