"use client";

import { buildDistrictDrivers } from "@/lib/utils";
import { DistrictId, SimulationResult } from "@/types/city";

type DistrictDriversProps = {
  result: SimulationResult;
  selectedDistrictId: DistrictId;
  selectedHour: number;
};

export function DistrictDrivers({ result, selectedDistrictId, selectedHour }: DistrictDriversProps) {
  const components = result.perDistrictComponents[selectedDistrictId][selectedHour];
  const drivers = buildDistrictDrivers(components);

  return (
    <section className="glass-panel p-4">
      <h3 className="text-xs uppercase tracking-[0.16em] text-cyan-300">Explainability Drivers</h3>
      <div className="mt-2 space-y-2">
        {drivers.map((driver) => (
          <div key={driver.label} className="flex items-center justify-between rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs">
            <span className="text-slate-200">{driver.label}</span>
            <span className={driver.tone === "up" ? "text-amber-200" : "text-emerald-300"}>
              {driver.tone === "up" ? "+" : "-"}
              {driver.valueMW.toFixed(1)} MW
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
