import "server-only";

import { findReportIdByKeyword } from "@/lib/ercot/discovery";
import { ercotFetch } from "@/lib/ercot/fetch";
import { ErcotForecastPoint, ErcotOutagePoint, ErcotPricePoint } from "@/types/city";

const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600 * 1000);

const asArray = (input: unknown): Record<string, unknown>[] => {
  if (Array.isArray(input)) return input as Record<string, unknown>[];
  if (input && typeof input === "object") {
    const r = input as Record<string, unknown>;
    const nested = [r.data, r.items, r.value, r.results];
    for (const n of nested) {
      if (Array.isArray(n)) return n as Record<string, unknown>[];
    }
  }
  return [];
};

const toNum = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const extractTime = (row: Record<string, unknown>) =>
  String(
    row.hourISO ?? row.timestampISO ?? row.timestamp ?? row.intervalISO ?? row.deliveryDate ?? row.datetime ?? new Date().toISOString(),
  );

const fetchReportRows = async (reportId: string, params?: Record<string, string>) => {
  const paths = [`/reports/${reportId}`, `/reports/${reportId}/data`, `/${reportId}`];
  for (const p of paths) {
    try {
      const data = await ercotFetch(p, params);
      const rows = asArray(data);
      if (rows.length > 0) return rows;
    } catch {
      continue;
    }
  }
  return [];
};

export async function getRealTimeSystemConditions(): Promise<{
  timestampISO: string;
  systemDemandMW: number;
  systemCapacityMW: number;
  windMW: number;
  solarMW: number;
}> {
  const report = await findReportIdByKeyword(["real", "time", "demand"]);
  if (report) {
    const rows = await fetchReportRows(report.reportId);
    if (rows.length) {
      const last = rows[rows.length - 1];
      const demand = toNum(last.systemDemandMW ?? last.demandMW ?? last.totalLoad ?? last.load);
      const cap = toNum(last.systemCapacityMW ?? last.availableCapacityMW ?? last.capacityMW ?? demand * 1.2);
      const wind = toNum(last.windMW ?? last.windGenMW ?? last.wind);
      const solar = toNum(last.solarMW ?? last.pvMW ?? last.solar);
      if (demand > 0) {
        return {
          timestampISO: extractTime(last),
          systemDemandMW: demand,
          systemCapacityMW: cap > 0 ? cap : demand * 1.2,
          windMW: wind,
          solarMW: solar,
        };
      }
    }
  }

  const now = new Date().toISOString();
  return {
    timestampISO: now,
    systemDemandMW: 46800,
    systemCapacityMW: 61200,
    windMW: 12800,
    solarMW: 5400,
  };
}

export async function getLoadForecast72h(): Promise<{
  timestampISO: string;
  points: ErcotForecastPoint[];
}> {
  const report = await findReportIdByKeyword(["load", "forecast"]);
  if (report) {
    const rows = await fetchReportRows(report.reportId);
    const mapped = rows
      .map((row) => ({
        hourISO: extractTime(row),
        demandMW: toNum(
          row.demandMW ?? row.forecastLoadMW ?? row.loadForecastMW ?? row.systemDemandMW ?? row.value,
        ),
        zone: String(row.weatherZone ?? row.zone ?? row.loadZone ?? ""),
      }))
      .filter((r) => r.demandMW > 0);

    if (mapped.length) {
      const austinish = mapped.filter((r) => /south|austin/i.test(r.zone));
      const use = austinish.length >= 40 ? austinish : mapped;
      return { timestampISO: new Date().toISOString(), points: use.slice(0, 73).map(({ hourISO, demandMW }) => ({ hourISO, demandMW })) };
    }
  }

  const now = new Date();
  const points: ErcotForecastPoint[] = Array.from({ length: 73 }, (_, i) => {
    const dayFrac = ((i + now.getHours()) % 24) / 24;
    const demand = 46000 * (0.9 + 0.17 * Math.sin(Math.PI * 2 * (dayFrac - 0.2)) + 0.09 * Math.exp(-((dayFrac - 0.78) ** 2) / (2 * 0.08 ** 2)));
    return { hourISO: addHours(now, i).toISOString(), demandMW: Math.max(26000, demand) };
  });
  return { timestampISO: now.toISOString(), points };
}

export async function getOutages72hByLoadZone(
  loadZone = "LZ_SOUTH",
): Promise<{ timestampISO: string; points: ErcotOutagePoint[] }> {
  const report = await findReportIdByKeyword(["outage", "load", "zone"]);
  if (report) {
    const rows = await fetchReportRows(report.reportId, { loadZone });
    const mapped = rows
      .filter((row) => {
        const z = String(row.loadZone ?? row.zone ?? "");
        return !z || z.toUpperCase() === loadZone.toUpperCase();
      })
      .map((row) => ({
        hourISO: extractTime(row),
        outagedMW: toNum(row.outagedMW ?? row.outageMW ?? row.capacityOutMW ?? row.value),
      }))
      .filter((p) => p.outagedMW >= 0);

    if (mapped.length) return { timestampISO: new Date().toISOString(), points: mapped.slice(0, 73) };
  }

  const now = new Date();
  const points: ErcotOutagePoint[] = Array.from({ length: 73 }, (_, i) => ({
    hourISO: addHours(now, i).toISOString(),
    outagedMW: 700 + 180 * Math.sin((i / 24) * Math.PI * 2),
  }));

  return { timestampISO: now.toISOString(), points };
}

export async function getSettlementPointPricesToday(
  points = ["LZ_SOUTH", "HB_SOUTH"],
): Promise<{ timestampISO: string; points: ErcotPricePoint[] }> {
  const report = await findReportIdByKeyword(["settlement", "price"]);
  if (report) {
    const rows = await fetchReportRows(report.reportId);
    const mapped = rows
      .map((row) => ({
        intervalISO: extractTime(row),
        settlementPoint: String(row.settlementPoint ?? row.pointName ?? row.hub ?? ""),
        price: toNum(row.price ?? row.lmp ?? row.spp ?? row.value),
      }))
      .filter((r) => points.includes(r.settlementPoint) && Number.isFinite(r.price));

    if (mapped.length) return { timestampISO: new Date().toISOString(), points: mapped };
  }

  const now = new Date();
  const fallback: ErcotPricePoint[] = points.map((p) => ({
    intervalISO: now.toISOString(),
    settlementPoint: p,
    price: p === "LZ_SOUTH" ? 34 : 29,
  }));
  return { timestampISO: now.toISOString(), points: fallback };
}
