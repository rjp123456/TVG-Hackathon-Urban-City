import "server-only";

import { ercotFetch } from "@/lib/ercot/fetch";

type CacheEntry = { expiresAtMs: number; data: unknown[] };

let cache: CacheEntry | null = null;

const normalizeList = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const candidates = [record.items, record.value, record.results, record.reports, record.data];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
  }
  return [];
};

const tryListPaths = async () => {
  const paths = ["/", "", "/reports", "/public-reports", "/list"];
  for (const path of paths) {
    try {
      const data = await ercotFetch(path);
      const list = normalizeList(data);
      if (list.length > 0) return list;
    } catch {
      continue;
    }
  }
  return [];
};

export async function listPublicReports(): Promise<unknown[]> {
  const now = Date.now();
  if (cache && cache.expiresAtMs > now) return cache.data;
  const data = await tryListPaths();
  cache = { data, expiresAtMs: now + 5 * 60 * 1000 };
  return data;
}

const textFromReport = (report: unknown) => {
  if (!report || typeof report !== "object") return "";
  const r = report as Record<string, unknown>;
  return [r.reportId, r.id, r.name, r.title, r.description, r.shortDescription]
    .map((v) => String(v ?? ""))
    .join(" ")
    .toLowerCase();
};

export async function findReportIdByKeyword(
  keywords: string[],
): Promise<{ reportId: string; label: string } | null> {
  const list = await listPublicReports();
  if (!list.length) return null;

  const scored = list
    .map((report) => {
      const hay = textFromReport(report);
      const score = keywords.reduce((acc, k) => (hay.includes(k.toLowerCase()) ? acc + 1 : acc), 0);
      const rec = report as Record<string, unknown>;
      const reportId = String(rec.reportId ?? rec.id ?? "");
      const label = String(rec.title ?? rec.name ?? rec.description ?? reportId);
      return { reportId, label, score };
    })
    .filter((r) => r.reportId);

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score === 0) return null;
  return { reportId: top.reportId, label: top.label };
}
