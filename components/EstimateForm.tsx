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
        label="Total Material Cost"
        value={inputs.materialLumpSum}
        onChange={(v) => set("materialLumpSum", v)}
        prefix="$"
        helper="Just your best total estimate for all materials - no per-gallon math."
      />

      <BigNumberField
        label="Total Labor Cost"
        value={inputs.laborLumpSum}
        onChange={(v) => set("laborLumpSum", v)}
        prefix="$"
        helper="Total labor for the whole job - no hourly math."
      />

      <div>
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          Markup / Profit
        </span>
        <div className="flex gap-2">
          <div className="grid w-32 shrink-0 grid-cols-1 gap-1">
            <button
              type="button"
              onClick={() =>
                onSettingsChange({ ...settings, markupMode: "percent" })
              }
              className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                settings.markupMode === "percent"
                  ? "border-lockhart-yellow bg-lockhart-yellow text-lockhart-asphalt"
                  : "border-neutral-300 bg-white text-neutral-600"
              }`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() =>
                onSettingsChange({ ...settings, markupMode: "flat" })
              }
              className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                settings.markupMode === "flat"
                  ? "border-lockhart-yellow bg-lockhart-yellow text-lockhart-asphalt"
                  : "border-neutral-300 bg-white text-neutral-600"
              }`}
            >
              $
            </button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            step={settings.markupMode === "percent" ? 1 : 10}
            min={0}
            value={settings.markupValue}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                markupValue: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
          />
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          {settings.markupMode === "percent"
            ? "Added on top of materials + labor as a percentage."
            : "Added on top of materials + labor as a flat dollar amount."}
        </p>
      </div>

      <div className="rounded-lg border-2 border-lockhart-yellow bg-amber-50 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-neutral-800">
            Final Quoted Price
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
        <p className="mt-1 text-xs text-neutral-400">
          Type over this to round to a clean number, like $1,500 - it's what
          goes on the PDF.
        </p>
      </div>

      <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-600">
          Settings (default sealcoat rate)
        </summary>
        <div className="mt-4">
          <BigNumberField
            label="Default Sealcoat Rate"
            value={settings.sealcoatRatePerSqFt}
            step={0.01}
            onChange={(v) =>
              onSettingsChange({ ...settings, sealcoatRatePerSqFt: v })
            }
            prefix="$"
            suffix="per sq ft"
            helper="Only used to auto-fill a starting Total Material Cost when you trace a lot - edit that field freely afterward."
          />
        </div>
      </details>
    </div>
  );
}
