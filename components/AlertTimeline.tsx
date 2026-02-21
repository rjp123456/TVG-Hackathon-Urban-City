"use client";

import { AlertPoint } from "@/types/city";

type AlertTimelineProps = {
  alerts: AlertPoint[];
  selectedHour: number;
  onJump: (hour: number) => void;
};

export function AlertTimeline({ alerts, selectedHour, onJump }: AlertTimelineProps) {
  return (
    <div className="relative mt-1 h-3 w-full rounded-full border border-white/10 bg-black/40">
      <div
        className="absolute top-0 h-3 w-0.5 bg-cyan-300/70"
        style={{ left: `${(selectedHour / 72) * 100}%` }}
      />
      {alerts.map((alert) => (
        <button
          key={`${alert.hour}-${alert.districtId}`}
          type="button"
          onClick={() => onJump(alert.hour)}
          className={`absolute top-0 h-3 w-[3px] rounded-full ${
            alert.level === "crit" ? "bg-rose-400" : "bg-amber-300"
          }`}
          style={{ left: `${(alert.hour / 72) * 100}%` }}
          title={`T+${alert.hour}h ${alert.districtId} prob ${alert.prob.toFixed(2)} stress ${alert.stress.toFixed(2)}`}
        />
      ))}
    </div>
  );
}
