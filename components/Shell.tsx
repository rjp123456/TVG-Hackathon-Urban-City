import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ShellProps = {
  topBar: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
};

export function Shell({ topBar, left, center, right, bottom }: ShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-city-bg text-slate-100">
      <div className="absolute inset-0 grid-overlay" aria-hidden />
      <div className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.16),transparent_68%)] blur-2xl" />

      <div className={cn("relative mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 md:px-6 md:py-6")}>
        {topBar}

        <section className="grid min-h-[620px] grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(560px,1fr)_380px]">
          {left}
          {center}
          {right}
        </section>

        {bottom}
      </div>
    </main>
  );
}
