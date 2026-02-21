import { NextResponse } from "next/server";
import { listPublicReports } from "@/lib/ercot/discovery";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reports = await listPublicReports();
    const sanitized = reports.slice(0, 300).map((r) => {
      const rec = (r ?? {}) as Record<string, unknown>;
      return {
        reportId: rec.reportId ?? rec.id ?? null,
        title: rec.title ?? rec.name ?? null,
        description: rec.description ?? rec.shortDescription ?? null,
      };
    });
    return NextResponse.json({ ok: true, count: sanitized.length, reports: sanitized });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
