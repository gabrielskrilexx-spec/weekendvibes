import React from "react";

type SkeletonBlockProps = { className?: string };

function SkeletonBlock({ className = "" }: SkeletonBlockProps) {
  return <div aria-hidden="true" className={`event-skeleton-block rounded-xl ${className}`} />;
}

export function EventCardSkeleton() {
  return (
    <article className="content-fade-in event-skeleton-shell overflow-hidden rounded-3xl border" aria-hidden="true">
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
    <div className="content-fade-in grid gap-5 sm:grid-cols-2" role="status" aria-label="Carregando eventos">
      {Array.from({ length: count }, (_, index) => <EventCardSkeleton key={index} />)}
    </div>
  );
}

export function AgendaWeekSkeleton() {
  return (
    <div className="content-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Carregando Agenda da Semana">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="event-skeleton-shell overflow-hidden rounded-2xl border" aria-hidden="true">
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
