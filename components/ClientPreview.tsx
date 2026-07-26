"use client";

import type { EstimateBreakdown } from "@/lib/estimation";

function currency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Read-only preview of exactly what ends up in the client's PDF: marked-up
 * service prices and a total. No labor rate, material cost, or margin
 * percentage ever renders here - keep it that way if you touch this file.
 */
export default function ClientPreview({
  breakdown,
  clientAddress,
}: {
  breakdown: EstimateBreakdown;
  clientAddress: string;
}) {
  return (
    <div className="rounded-lg border border-lockhart-yellow/40 bg-lockhart-asphalt p-4 text-neutral-100 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-lockhart-yellow">
        Lockhart Surface Solutions
      </p>
      <p className="mb-3 text-xs text-neutral-400">
        {clientAddress || "Project address"}
      </p>
      <div className="divide-y divide-white/10">
        {breakdown.customer.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-1.5 text-sm"
          >
            <span>{item.label}</span>
            <span className="tabular-nums">{currency(item.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-white/20 pt-2 text-base font-semibold">
        <span>Total Investment</span>
        <span>{currency(breakdown.customerTotal)}</span>
      </div>
    </div>
  );
}
