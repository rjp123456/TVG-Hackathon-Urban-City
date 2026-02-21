import { NextResponse } from "next/server";
import { findReportIdByKeyword, listPublicReports } from "@/lib/ercot/discovery";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reports = await listPublicReports();

    const picks = {
      realtime: await findReportIdByKeyword(["real", "time", "demand"]),
      forecast: await findReportIdByKeyword(["load", "forecast"]),
      outages: await findReportIdByKeyword(["outage", "load", "zone"]),
      prices: await findReportIdByKeyword(["settlement", "price"]),
    };

    return NextResponse.json({
      ok: true,
      reportCount: reports.length,
      picks,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
