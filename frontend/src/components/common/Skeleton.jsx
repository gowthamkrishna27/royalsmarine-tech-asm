import React from 'react';

/**
 * Base Skeleton building block with smooth pulsing effect.
 */
export default function Skeleton({ className = '', variant = 'text', width, height, style = {} }) {
  const base = 'animate-pulse bg-gray-200/80 shrink-0';

  let variantStyle = 'rounded';
  if (variant === 'circular' || variant === 'avatar') {
    variantStyle = 'rounded-full';
  } else if (variant === 'rounded' || variant === 'badge') {
    variantStyle = 'rounded-full';
  } else if (variant === 'card' || variant === 'box') {
    variantStyle = 'rounded-xl';
  } else if (variant === 'button') {
    variantStyle = 'rounded-lg';
  }

  const customStyle = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...style,
  };

  return <div className={`${base} ${variantStyle} ${className}`} style={customStyle} />;
}

export { Skeleton };

/**
 * Responsive Table Skeleton
 * Displays a desktop table skeleton on >= sm screens and card skeleton on mobile screens.
 */
export function TableSkeleton({ rows = 6, cols = 6, className = '' }) {
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: cols });

  return (
    <div className={`card overflow-hidden ${className}`}>
      {/* Desktop Table View */}
      <div className="hidden sm:block table-container border-0">
        <table className="table">
          <thead>
            <tr>
              {colArray.map((_, i) => (
                <th key={i} className="py-3.5">
                  <Skeleton className={`h-3.5 ${i === 0 ? 'w-28' : i === cols - 1 ? 'w-12 ml-auto' : 'w-20'}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rowArray.map((_, rIdx) => (
              <tr key={rIdx} className="hover:bg-transparent">
                {colArray.map((_, cIdx) => (
                  <td key={cIdx} className="py-4">
                    {cIdx === 0 ? (
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-36 sm:w-44" />
                        <Skeleton className="h-3 w-24 bg-gray-200/50" />
                      </div>
                    ) : cIdx === cols - 1 ? (
                      <Skeleton className="h-4 w-12 ml-auto" />
                    ) : cIdx === cols - 2 ? (
                      <Skeleton className="h-5 w-16 rounded-full" />
                    ) : (
                      <Skeleton className={`h-3.5 ${cIdx % 2 === 0 ? 'w-24' : 'w-20'}`} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="sm:hidden divide-y divide-gray-100">
        {rowArray.map((_, idx) => (
          <div key={idx} className="p-4 space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28 bg-gray-200/60" />
                <Skeleton className="h-3 w-32 bg-gray-200/50" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full shrink-0" />
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-3 w-24 bg-gray-200/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Metric / Quick Stat Cards Skeleton Grid
 */
export function CardSkeleton({ count = 3, className = '' }) {
  const cards = Array.from({ length: count });

  return (
    <div className={`grid gap-2 sm:gap-3 ${count === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} ${className}`}>
      {cards.map((_, i) => (
        <div key={i} className="card p-2.5 sm:p-4 flex items-center gap-2.5 sm:gap-3 border-l-4 border-gray-200">
          <Skeleton className="w-6 h-6 sm:w-8 sm:h-8 rounded-full shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-5 sm:h-7 w-10 sm:w-14" />
            <Skeleton className="h-3 w-16 sm:w-24 bg-gray-200/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Followups & Dues List
 */
export function FollowupListSkeleton({ count = 5 }) {
  const items = Array.from({ length: count });

  return (
    <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden divide-y divide-gray-100">
      {items.map((_, i) => (
        <div key={i} className="p-3.5 sm:p-4 sm:flex sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2.5">
            {/* Title & Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Skeleton className="h-4.5 w-48 sm:w-60" />
              <Skeleton className="h-4 w-28 rounded-full bg-indigo-100/60" />
              <Skeleton className="h-4 w-16 rounded-full bg-amber-100/60" />
            </div>

            {/* Tank/Pond info */}
            <Skeleton className="h-3 w-36 bg-gray-200/60" />

            {/* Farmer & Location */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24 bg-gray-200/50" />
            </div>

            {/* Executive & Date info */}
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
                <Skeleton className="h-3 w-28 bg-gray-200/60" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3.5 w-3.5 rounded" />
                <Skeleton className="h-3 w-24 bg-gray-200/60" />
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="mt-3 sm:mt-0 shrink-0">
            <Skeleton className="h-7 w-24 rounded-lg bg-emerald-100/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Dashboard
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-64 bg-gray-200/60" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton className="h-6 sm:h-8 w-12 sm:w-16" />
              <Skeleton className="h-3 w-20 sm:w-28 bg-gray-200/60" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Chart & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-20 bg-gray-200/60" />
          </div>
          <Skeleton className="h-56 sm:h-72 w-full rounded-xl bg-gray-100" />
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-14 bg-gray-200/60" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-20 bg-gray-200/50" />
                </div>
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for Detail pages (ClientDetail, VisitDetail)
 */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-48 sm:w-64" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-3 w-32 bg-gray-200/60" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-3">
            <Skeleton className="h-4 w-28 font-medium" />
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-gray-200/60" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-gray-200/60" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-gray-200/60" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Section / Table */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-16 bg-gray-200/60" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3.5 rounded-xl border border-gray-100 flex items-center justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56 bg-gray-200/60" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
