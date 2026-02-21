import "server-only";

import { getErcotToken } from "@/lib/ercot/auth";

const BASE_URL = "https://api.ercot.com/api/public-reports";

const requireSubKey = () => {
  const v = process.env.ERCOT_SUBSCRIPTION_KEY;
  if (!v) throw new Error("Missing ERCOT_SUBSCRIPTION_KEY in environment");
  return v;
};

export async function ercotFetch(
  path: string,
  searchParams?: Record<string, string>,
  init?: RequestInit,
): Promise<unknown> {
  const token = await getErcotToken();
  const subKey = requireSubKey();

  const url = new URL(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Ocp-Apim-Subscription-Key": subKey,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    const snippet = typeof parsed === "string" ? parsed.slice(0, 200) : JSON.stringify(parsed).slice(0, 200);
    throw new Error(`ERCOT fetch failed ${res.status}: ${snippet}`);
  }

  return parsed;
}
