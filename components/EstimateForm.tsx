"use client";

import type { EstimateInputs } from "@/lib/estimation";

interface EstimateFormProps {
  inputs: EstimateInputs;
  onChange: (next: EstimateInputs) => void;
  autoSqFt: number | null;
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.01,
  min = 0,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
        />
        {suffix && (
          <span className="whitespace-nowrap text-xs text-neutral-500">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

export default function EstimateForm({
  inputs,
  onChange,
  autoSqFt,
}: EstimateFormProps) {
  const set = <K extends keyof EstimateInputs>(
    key: K,
    value: EstimateInputs[K]
  ) => onChange({ ...inputs, [key]: value });

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Lot Size
        </h2>
        <NumberField
          label={
            autoSqFt !== null
              ? "Total Square Footage (auto-filled from map trace, editable)"
              : "Total Square Footage (trace the lot on the map, or enter manually)"
          }
          value={inputs.totalSqFt}
          step={1}
          onChange={(v) => set("totalSqFt", v)}
          suffix="sq ft"
        />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <h2 className="col-span-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Striping
        </h2>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Unit
          </span>
          <select
            value={inputs.stripingUnit}
            onChange={(e) =>
              set("stripingUnit", e.target.value as EstimateInputs["stripingUnit"])
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
          >
            <option value="spaces">Parking Spaces</option>
            <option value="linearFeet">Linear Feet</option>
          </select>
        </label>
        <NumberField
          label={
            inputs.stripingUnit === "spaces"
              ? "Number of Spaces"
              : "Linear Feet to Stripe"
          }
          value={inputs.stripingQuantity}
          step={1}
          onChange={(v) => set("stripingQuantity", v)}
        />
        <div className="col-span-2">
          <NumberField
            label={`Paint Material Cost (per ${
              inputs.stripingUnit === "spaces" ? "space" : "linear ft"
            })`}
            value={inputs.paintCostPerUnit}
            onChange={(v) => set("paintCostPerUnit", v)}
            suffix="$"
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <h2 className="col-span-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Sealant
        </h2>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Pricing Mode
          </span>
          <select
            value={inputs.sealantPricingMode}
            onChange={(e) =>
              set(
                "sealantPricingMode",
                e.target.value as EstimateInputs["sealantPricingMode"]
              )
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
          >
            <option value="perSqFt">Per Square Foot</option>
            <option value="perGallon">Per Gallon (with coverage rate)</option>
          </select>
        </label>
        {inputs.sealantPricingMode === "perSqFt" ? (
          <div className="col-span-2">
            <NumberField
              label="Sealant Cost (per sq ft)"
              value={inputs.sealantCostPerSqFt}
              onChange={(v) => set("sealantCostPerSqFt", v)}
              suffix="$"
            />
          </div>
        ) : (
          <>
            <NumberField
              label="Sealant Cost (per gallon)"
              value={inputs.sealantCostPerGallon}
              onChange={(v) => set("sealantCostPerGallon", v)}
              suffix="$"
            />
            <NumberField
              label="Coverage Rate"
              value={inputs.sealantCoverageSqFtPerGallon}
              step={1}
              onChange={(v) => set("sealantCoverageSqFtPerGallon", v)}
              suffix="sq ft/gal"
            />
          </>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <h2 className="col-span-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Labor & Prep
        </h2>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Labor Pricing Mode
          </span>
          <select
            value={inputs.laborMode}
            onChange={(e) =>
              set("laborMode", e.target.value as EstimateInputs["laborMode"])
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
          >
            <option value="perSqFt">Per Square Foot</option>
            <option value="perHour">Per Hour</option>
          </select>
        </label>
        {inputs.laborMode === "perSqFt" ? (
          <div className="col-span-2">
            <NumberField
              label="Labor Cost (per sq ft)"
              value={inputs.laborRate}
              onChange={(v) => set("laborRate", v)}
              suffix="$"
            />
          </div>
        ) : (
          <>
            <NumberField
              label="Labor Rate (per hour)"
              value={inputs.laborRate}
              onChange={(v) => set("laborRate", v)}
              suffix="$"
            />
            <NumberField
              label="Estimated Hours"
              value={inputs.laborHours}
              onChange={(v) => set("laborHours", v)}
              suffix="hrs"
            />
          </>
        )}
        <div className="col-span-2">
          <NumberField
            label="Prep / Cleaning Cost (per sq ft)"
            value={inputs.prepCostPerSqFt}
            onChange={(v) => set("prepCostPerSqFt", v)}
            suffix="$"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Profit
        </h2>
        <NumberField
          label="Profit Margin / Markup"
          value={inputs.marginPercent}
          step={1}
          onChange={(v) => set("marginPercent", v)}
          suffix="%"
        />
      </section>
    </div>
  );
}
