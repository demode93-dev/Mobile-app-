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
        Estimate Summary (internal)
      </h2>
      <p className="mb-2 text-xs text-neutral-400">
        Updates live as you trace the lot or adjust variables. This full
        cost breakdown is for your reference only — the PDF export shows
        customer-facing prices with labor and margin folded in.
      </p>
      <div className="divide-y divide-neutral-100">
        {row("Prep / Cleaning", internal.prep)}
        {row("Seal Coating (material)", internal.sealCoat)}
        {row("Striping (material)", internal.striping)}
        {row("Labor", internal.labor)}
      </div>
      <div className="mt-2 border-t border-neutral-200 pt-2">
        {row("Subtotal (cost)", internal.subtotal)}
        {row(`Margin`, internal.marginAmount)}
        {row("Total Quote", internal.total, true)}
      </div>
    </div>
  );
}
