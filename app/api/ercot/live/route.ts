import { NextResponse } from "next/server";
import {
  getLoadForecast72h,
  getOutages72hByLoadZone,
  getRealTimeSystemConditions,
  getSettlementPointPricesToday,
} from "@/lib/ercot/metrics";
import { ErcotLiveBundle } from "@/types/city";

export const dynamic = "force-dynamic";

export async function GET() {
  const errors: string[] = [];
  const bundle: ErcotLiveBundle = {
    ok: true,
    fetchedAtISO: new Date().toISOString(),
    austinProxy: { loadZone: "LZ_SOUTH", hub: "HB_SOUTH" },
  };

  await Promise.all([
    getRealTimeSystemConditions()
      .then((realtime) => {
        bundle.realtime = realtime;
      })
      .catch((e) => errors.push(`realtime: ${e instanceof Error ? e.message : "failed"}`)),
    getLoadForecast72h()
      .then((forecast72h) => {
        bundle.forecast72h = forecast72h;
      })
      .catch((e) => errors.push(`forecast72h: ${e instanceof Error ? e.message : "failed"}`)),
    getOutages72hByLoadZone("LZ_SOUTH")
      .then((outages72h) => {
        bundle.outages72h = { loadZone: "LZ_SOUTH", ...outages72h };
      })
      .catch((e) => errors.push(`outages72h: ${e instanceof Error ? e.message : "failed"}`)),
    getSettlementPointPricesToday(["LZ_SOUTH", "HB_SOUTH"])
      .then((prices) => {
        bundle.prices = prices;
      })
      .catch((e) => errors.push(`prices: ${e instanceof Error ? e.message : "failed"}`)),
  ]);

  if (errors.length) {
    bundle.ok = false;
    bundle.errors = errors;
  }

  return NextResponse.json(bundle, { status: 200 });
}
