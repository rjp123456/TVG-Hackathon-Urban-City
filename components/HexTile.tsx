"use client";

import { District } from "@/types/city";
import { cn } from "@/lib/utils";

type HexTileProps = {
  district: District;
  label: string;
  points: string;
  cx: number;
  cy: number;
  stress: number;
  selected: boolean;
  markers: string[];
  showCriticalShield: boolean;
  onClick: () => void;
  onHover: (args: { district: District; x: number; y: number } | null) => void;
};

const stressClass = (stress: number) => {
  if (stress < 0.7) return "hex-stress-safe";
  if (stress < 0.9) return "hex-stress-watch";
  if (stress <= 1.0) return "hex-stress-warn";
  return "hex-stress-critical";
};

export function HexTile({
  district,
  label,
  points,
  cx,
  cy,
  stress,
  selected,
  markers,
  showCriticalShield,
  onClick,
  onHover,
}: HexTileProps) {
  return (
    <g
      onClick={onClick}
      onMouseEnter={(e) => onHover({ district, x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => onHover({ district, x: e.clientX, y: e.clientY })}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer"
    >
      <polygon
        points={points}
        className={cn(
          "hex-tile transition-all duration-300",
          stressClass(stress),
          selected && "hex-selected",
          stress > 1 && "hex-pulse",
        )}
      />

      <text
        x={cx}
        y={cy - 3}
        className="pointer-events-none select-none fill-slate-100 text-[12px] font-medium"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {label}
      </text>

      {showCriticalShield && (
        <g>
          <circle cx={cx + 34} cy={cy - 35} r={8} className="fill-cyan-300/20 stroke-cyan-300/70" />
          <text
            x={cx + 34}
            y={cy - 35}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-cyan-200 text-[10px] font-semibold"
          >
            S
          </text>
        </g>
      )}

      {markers.length > 0 && (
        <g>
          <rect
            x={cx - 28}
            y={cy + 14}
            rx={7}
            ry={7}
            width={56}
            height={14}
            className="fill-black/45 stroke-white/20"
          />
          <text
            x={cx}
            y={cy + 21}
            textAnchor="middle"
            className="fill-emerald-200 text-[9px]"
          >
            {markers.join(" ")}
          </text>
        </g>
      )}
    </g>
  );
}
