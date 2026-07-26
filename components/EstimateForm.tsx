"use client";

import {
  computeSuggestedFinalPrice,
  type EstimateInputs,
  type EstimateSettings,
} from "@/lib/estimation";

interface EstimateFormProps {
  inputs: EstimateInputs;
  onChange: (next: EstimateInputs) => void;
  settings: EstimateSettings;
  onSettingsChange: (next: EstimateSettings) => void;
}

function BigNumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  prefix,
  suffix,
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  prefix?: string;
  suffix?: string;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-lg text-neutral-500">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
        />
        {suffix && (
          <span className="whitespace-nowrap text-sm text-neutral-500">
            {suffix}
          </span>
        )}
      </div>
      {helper && <p className="mt-1 text-xs text-neutral-400">{helper}</p>}
    </label>
  );
}

export default function EstimateForm({
  inputs,
  onChange,
  settings,
  onSettingsChange,
}: EstimateFormProps) {
  const set = <K extends keyof EstimateInputs>(
    key: K,
    value: EstimateInputs[K]
  ) => onChange({ ...inputs, [key]: value });

  const suggestedFinalPrice = computeSuggestedFinalPrice(inputs, settings);
  const finalPriceValue = inputs.finalPriceOverride ?? suggestedFinalPrice;

  return (
    <div className="space-y-5">
      <BigNumberField
        label="Total Square Footage"
        value={inputs.totalSqFt}
        onChange={(v) => set("totalSqFt", v)}
        suffix="sq ft"
        helper="Auto-filled when you trace the lot on the map above. Adjust here if needed."
      />

      <BigNumberField
        label="Number of Spaces to Stripe"
        value={inputs.numberOfSpaces}
        onChange={(v) => set("numberOfSpaces", v)}
        helper="Enter 0 if this job is sealcoating only."
      />

      <BigNumberField
        label="Lump Sum Material Cost"
        value={inputs.materialLumpSum}
        onChange={(v) => set("materialLumpSum", v)}
        prefix="$"
        helper="Just your best total estimate for all materials - no per-gallon math."
      />

      <BigNumberField
        label="Lump Sum Labor Cost"
        value={inputs.laborLumpSum}
        onChange={(v) => set("laborLumpSum", v)}
        prefix="$"
        helper="Total labor for the whole job - no hourly math."
      />

      <div className="rounded-lg border-2 border-lockhart-yellow bg-amber-50 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-neutral-800">
            Final Quote Price
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg text-neutral-500">$</span>
            <input
              type="number"
              inputMode="decimal"
              step={1}
              min={0}
              value={finalPriceValue}
              onChange={(e) =>
                set("finalPriceOverride", parseFloat(e.target.value) || 0)
              }
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
            />
          </div>
        </label>
        <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Suggested from your numbers: $
            {suggestedFinalPrice.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </span>
          {inputs.finalPriceOverride !== null && (
            <button
              type="button"
              onClick={() => set("finalPriceOverride", null)}
              className="font-medium text-lockhart-amber underline"
            >
              Reset to suggested
            </button>
          )}
        </div>
      </div>

      <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-600">
          Settings (default rates & markup)
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Pricing Method for Suggested Price
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onSettingsChange({ ...settings, pricingMode: "markupOnCosts" })
                }
                className={`rounded-lg border px-3 py-3 text-sm font-medium ${
                  settings.pricingMode === "markupOnCosts"
                    ? "border-lockhart-yellow bg-lockhart-yellow text-lockhart-asphalt"
                    : "border-neutral-300 bg-white text-neutral-600"
                }`}
              >
                Markup on Costs
              </button>
              <button
                type="button"
                onClick={() =>
                  onSettingsChange({ ...settings, pricingMode: "flatRatePerSqFt" })
                }
                className={`rounded-lg border px-3 py-3 text-sm font-medium ${
                  settings.pricingMode === "flatRatePerSqFt"
                    ? "border-lockhart-yellow bg-lockhart-yellow text-lockhart-asphalt"
                    : "border-neutral-300 bg-white text-neutral-600"
                }`}
              >
                Flat Rate by Size
              </button>
            </div>
          </div>

          <BigNumberField
            label="Default Sealcoat Rate"
            value={settings.sealcoatRatePerSqFt}
            step={0.01}
            onChange={(v) =>
              onSettingsChange({ ...settings, sealcoatRatePerSqFt: v })
            }
            prefix="$"
            suffix="per sq ft"
            helper="Used to auto-fill the material cost baseline when you trace a lot, and for flat-rate pricing."
          />
          <BigNumberField
            label="Default Striping Rate"
            value={settings.stripingRatePerSpace}
            onChange={(v) =>
              onSettingsChange({ ...settings, stripingRatePerSpace: v })
            }
            prefix="$"
            suffix="per space"
            helper="Used for flat-rate pricing and to split the PDF's service line items."
          />
          <BigNumberField
            label="Markup"
            value={settings.markupPercent}
            onChange={(v) => onSettingsChange({ ...settings, markupPercent: v })}
            suffix="%"
            helper="Applied on top of your material + labor lump sums."
          />
        </div>
      </details>
    </div>
  );
}
