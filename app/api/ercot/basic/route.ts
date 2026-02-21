import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BasicPayload = {
  ok: boolean;
  timestampISO: string;
  systemDemandMW: number;
  windMW: number;
  solarMW: number;
  renewablesShare?: number;
};

const FALLBACK: BasicPayload = {
  ok: false,
  timestampISO: new Date().toISOString(),
  systemDemandMW: 72000,
  windMW: 18000,
  solarMW: 9000,
};

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const pickLatestRow = (data: unknown): Record<string, unknown> | null => {
  if (Array.isArray(data) && data.length) return data[data.length - 1] as Record<string, unknown>;
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    const arr = [rec.data, rec.items, rec.value, rec.results].find((v) => Array.isArray(v)) as
      | Record<string, unknown>[]
      | undefined;
    if (arr && arr.length) return arr[arr.length - 1];
    return rec;
  }
  return null;
};

export async function GET() {
  try {
    const subKey = process.env.ERCOT_SUBSCRIPTION_KEY;
    if (!subKey) throw new Error("Missing ERCOT_SUBSCRIPTION_KEY");

    const bearer = process.env.ERCOT_BEARER_TOKEN;

    const candidates = [
      "https://api.ercot.com/api/public-reports/realtime/system-conditions",
      "https://api.ercot.com/api/public-reports/system-conditions",
      "https://api.ercot.com/api/public-reports/reports/system-conditions",
    ];

    let parsed: unknown = null;
    for (const url of candidates) {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Ocp-Apim-Subscription-Key": subKey,
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        cache: "no-store",
      });

      if (res.ok) {
        parsed = (await res.json()) as unknown;
        break;
      }

      if (res.status === 401 && !bearer) {
        // Endpoint may require bearer token. Keeping auth lightweight for demo.
        continue;
      }
    }

    const row = pickLatestRow(parsed);
    if (!row) return NextResponse.json(FALLBACK, { status: 200 });

    const systemDemandMW =
      toNum(row.systemDemandMW) ||
      toNum(row.demandMW) ||
      toNum(row.totalLoadMW) ||
      toNum(row.loadMW) ||
      NaN;

    const windMW = toNum(row.windMW) || toNum(row.windGenerationMW) || toNum(row.wind) || NaN;
    const solarMW = toNum(row.solarMW) || toNum(row.pvMW) || toNum(row.solarGenerationMW) || NaN;

    if (!Number.isFinite(systemDemandMW)) {
      return NextResponse.json(FALLBACK, { status: 200 });
    }

    const safeWind = Number.isFinite(windMW) ? windMW : 0;
    const safeSolar = Number.isFinite(solarMW) ? solarMW : 0;
    const renewablesShare = (safeWind + safeSolar) / Math.max(1, systemDemandMW);

    const out: BasicPayload = {
      ok: true,
      timestampISO: String(
        row.timestampISO ?? row.timestamp ?? row.deliveryDate ?? row.datetime ?? new Date().toISOString(),
      ),
      systemDemandMW,
      windMW: safeWind,
      solarMW: safeSolar,
      renewablesShare,
    };

    return NextResponse.json(out, { status: 200 });
  } catch {
    return NextResponse.json(FALLBACK, { status: 200 });
  }
}
