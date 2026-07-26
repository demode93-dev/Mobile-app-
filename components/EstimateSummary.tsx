"use client";

import type { EstimateBreakdown } from "@/lib/estimation";

function currency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function EstimateSummary({
  breakdown,
}: {
  breakdown: EstimateBreakdown;
}) {
  const { internal } = breakdown;
  const row = (label: string, amount: number, emphasis = false) => (
    <div
      className={`flex items-center justify-between py-1.5 ${
        emphasis ? "text-base font-semibold" : "text-sm text-neutral-700"
      }`}
    >
      <span>{label}</span>
      <span className={emphasis ? "" : "tabular-nums"}>{currency(amount)}</span>
    </div>
  );

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Cost & Profit Breakdown
      </h2>
      <p className="mb-2 text-xs text-neutral-400">
        For the Estimator's eyes only — the Property Owner never sees this
        section, only the Final Quoted Price below.
      </p>
      <div className="divide-y divide-neutral-100">
        {row("Material + Labor Cost", internal.cost)}
        {row("Markup", internal.markupAmount)}
        {row("Profit", internal.profit)}
      </div>
      <div className="mt-2 border-t border-neutral-200 pt-2">
        {row(
          internal.isOverridden ? "Suggested Price (before override)" : "Suggested Price",
          internal.suggestedFinalPrice
        )}
        {row("Final Quoted Price", internal.finalPrice, true)}
      </div>
      {internal.isOverridden && (
        <p className="mt-2 text-xs font-medium text-lockhart-amber">
          You've overridden the suggested price above.
        </p>
      )}
    </div>
  );
}
