"use client";

import { useMemo, useState } from "react";
import { HexTile } from "@/components/HexTile";
import { districtHasOverrides } from "@/lib/utils";
import { District, DistrictId, DistrictOverrides, SimulationResult } from "@/types/city";

type HexCityMapProps = {
  districts: readonly District[];
  edges: readonly (readonly [DistrictId, DistrictId])[];
  overrides: DistrictOverrides;
  criticalPriorityEnabled: boolean;
  result: SimulationResult;
  selectedHour: number;
  selectedDistrictId: DistrictId;
  setSelectedDistrictId: (id: DistrictId) => void;
};

type HoverState = {
  district: District;
  x: number;
  y: number;
} | null;

const HEX_SIZE = 74;

const toPixel = (q: number, r: number, size: number) => ({
  x: size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
  y: size * (1.5 * r),
});

const hexPoints = (cx: number, cy: number, size: number) => {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return points.join(" ");
};

export function HexCityMap({
  districts,
  edges,
  overrides,
  criticalPriorityEnabled,
  result,
  selectedHour,
  selectedDistrictId,
  setSelectedDistrictId,
}: HexCityMapProps) {
  const [hovered, setHovered] = useState<HoverState>(null);

  const projected = useMemo(() => {
    const positions = districts.map((district) => {
      const p = toPixel(district.q, district.r, HEX_SIZE);
      return { ...district, cx: p.x, cy: p.y, points: hexPoints(p.x, p.y, HEX_SIZE * 0.92) };
    });

    const xs = positions.map((d) => d.cx);
    const ys = positions.map((d) => d.cy);
    const minX = Math.min(...xs) - HEX_SIZE * 2;
    const maxX = Math.max(...xs) + HEX_SIZE * 2;
    const minY = Math.min(...ys) - HEX_SIZE * 2;
    const maxY = Math.max(...ys) + HEX_SIZE * 2;

    return {
      positions,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
      byId: Object.fromEntries(positions.map((d) => [d.id, d])) as Record<DistrictId, (typeof positions)[0]>,
    };
  }, [districts]);

  const hoveredData = hovered
    ? {
        load: result.perDistrict[hovered.district.id].loadMW[selectedHour],
        cap: result.perDistrict[hovered.district.id].capMW[selectedHour],
        stress: result.perDistrict[hovered.district.id].stress[selectedHour],
        prob: result.perDistrict[hovered.district.id].prob[selectedHour],
      }
    : null;

  return (
    <div className="glass-panel relative h-full min-h-[560px] overflow-hidden p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span className="uppercase tracking-[0.2em] text-emerald-300/90">Transformer Risk Model</span>
        <span>T+{selectedHour}h</span>
      </div>

      <svg viewBox={projected.viewBox} className="h-[calc(100%-26px)] w-full">
        <g>
          {edges.map(([a, b], idx) => {
            const p1 = projected.byId[a];
            const p2 = projected.byId[b];
            const path = `M ${p1.cx} ${p1.cy} L ${p2.cx} ${p2.cy}`;
            return (
              <g key={`${a}-${b}`}>
                <line x1={p1.cx} y1={p1.cy} x2={p2.cx} y2={p2.cy} className="hex-edge" />
                <circle r="3.5" className="fill-cyan-300/75">
                  <animateMotion dur={`${4 + (idx % 3)}s`} repeatCount="indefinite" path={path} />
                </circle>
              </g>
            );
          })}
        </g>

        <g>
          {projected.positions.map((district) => {
            const o = overrides[district.id];
            const markers = [
              (o.storageMWh ?? 0) > 0 ? "BAT" : "",
              (o.capBoostMW ?? 0) > 0 ? "CAP" : "",
              (o.solarBoost ?? 0) > 0 ? "SOL" : "",
              o.drEnabled ? "DR" : "",
            ].filter(Boolean);

            return (
              <HexTile
                key={district.id}
                district={district}
                points={district.points}
                cx={district.cx}
                cy={district.cy}
                stress={result.perDistrict[district.id].stress[selectedHour]}
                selected={district.id === selectedDistrictId}
                markers={markers}
                showCriticalShield={
                  criticalPriorityEnabled && (district.id === "medical" || district.id === "downtown")
                }
                onClick={() => setSelectedDistrictId(district.id)}
                onHover={setHovered}
              />
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-4 left-4 rounded-md border border-white/10 bg-black/45 px-3 py-2 text-[11px] text-slate-200 backdrop-blur-sm">
        <div className="mb-1">Stress Index</div>
        <div className="h-2 w-28 rounded-full bg-[linear-gradient(90deg,#10b981,#facc15,#fb923c,#ef4444)]" />
      </div>

      {hovered && hoveredData && (
        <div
          className="pointer-events-none fixed z-40 rounded-md border border-white/10 bg-black/80 px-3 py-2 text-xs text-slate-100 shadow-2xl backdrop-blur"
          style={{ left: hovered.x + 14, top: hovered.y + 14 }}
        >
          <div className="font-medium text-emerald-300">{hovered.district.name}</div>
          <div>Load: {hoveredData.load.toFixed(1)} MW</div>
          <div>Cap: {hoveredData.cap.toFixed(1)} MW</div>
          <div>Stress: {(hoveredData.stress * 100).toFixed(0)}%</div>
          <div>Overload Prob: {(hoveredData.prob * 100).toFixed(0)}%</div>
          {districtHasOverrides(overrides[hovered.district.id]) && (
            <div className="mt-1 text-[11px] text-cyan-200">
              Overrides: BAT {(overrides[hovered.district.id].storageMWh ?? 0).toFixed(1)} | CAP +
              {(overrides[hovered.district.id].capBoostMW ?? 0).toFixed(0)} | SOL +
              {((overrides[hovered.district.id].solarBoost ?? 0) * 100).toFixed(0)}%
              {overrides[hovered.district.id].drEnabled ? " | DR" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
