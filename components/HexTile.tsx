"use client";

import { District } from "@/types/city";
import { cn } from "@/lib/utils";

type HexTileProps = {
  district: District;
  points: string;
  cx: number;
  cy: number;
  stress: number;
  selected: boolean;
  onClick: () => void;
  onHover: (args: { district: District; x: number; y: number } | null) => void;
};

const stressClass = (stress: number) => {
  if (stress < 0.7) return "hex-stress-safe";
  if (stress < 0.9) return "hex-stress-watch";
  if (stress <= 1.0) return "hex-stress-warn";
  return "hex-stress-critical";
};

export function HexTile({ district, points, cx, cy, stress, selected, onClick, onHover }: HexTileProps) {
  return (
    <g
      onClick={onClick}
      onMouseEnter={(e) =>
        onHover({
          district,
          x: e.clientX,
          y: e.clientY,
        })
      }
      onMouseMove={(e) =>
        onHover({
          district,
          x: e.clientX,
          y: e.clientY,
        })
      }
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
        y={cy}
        className="pointer-events-none select-none fill-slate-100 text-[12px] font-medium"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {district.name.split(" ")[0]}
      </text>
    </g>
  );
}
