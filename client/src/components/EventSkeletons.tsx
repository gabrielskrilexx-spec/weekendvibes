import React from "react";

type SkeletonBlockProps = { className?: string };

function SkeletonBlock({ className = "" }: SkeletonBlockProps) {
  return <div aria-hidden="true" className={`rounded-xl bg-white/[0.08] motion-safe:animate-pulse ${className}`} />;
}

export function EventCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]" aria-hidden="true">
      <SkeletonBlock className="aspect-[16/10] rounded-none" />
      <div className="space-y-3 p-5">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-6 w-4/5" />
        <SkeletonBlock className="h-4 w-3/5" />
        <div className="flex gap-2 pt-2">
          <SkeletonBlock className="h-7 w-20 rounded-full" />
          <SkeletonBlock className="h-7 w-24 rounded-full" />
        </div>
      </div>
    </article>
  );
}

export function EventGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2" role="status" aria-label="Carregando eventos">
      {Array.from({ length: count }, (_, index) => <EventCardSkeleton key={index} />)}
    </div>
  );
}

export function AgendaWeekSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Carregando Agenda da Semana">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60" aria-hidden="true">
          <SkeletonBlock className="aspect-[16/9] rounded-none" />
          <div className="space-y-3 p-4">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-5 w-4/5" />
            <SkeletonBlock className="h-4 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default EventGridSkeleton;
