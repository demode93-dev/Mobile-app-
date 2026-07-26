"use client";

import type { EstimateBreakdown } from "@/lib/estimation";

function currency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Read-only preview of exactly what ends up in the Property Owner's PDF: a
 * plain list of services and one lump-sum total. No labor rate, material
 * cost, or margin ever renders here - keep it that way if you touch this file.
 */
export default function ClientPreview({
  breakdown,
  propertyAddress,
}: {
  breakdown: EstimateBreakdown;
  propertyAddress: string;
}) {
  return (
    <div className="rounded-lg border border-lockhart-yellow/40 bg-lockhart-asphalt p-4 text-neutral-100 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-lockhart-yellow">
        Lockhart Surface Solutions
      </p>
      <p className="mb-3 text-xs text-neutral-400">
        {propertyAddress || "Project address"}
      </p>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Services Included
      </p>
      <ul className="mb-3 space-y-1 text-sm">
        {breakdown.services.map((service) => (
          <li key={service} className="flex items-center gap-2">
            <span className="text-lockhart-yellow">&#10003;</span>
            {service}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-white/20 pt-2 text-base font-semibold">
        <span>Final Quoted Price</span>
        <span>{currency(breakdown.finalPrice)}</span>
      </div>
    </div>
  );
}
