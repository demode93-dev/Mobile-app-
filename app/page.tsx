"use client";

import { useMemo, useState } from "react";
import MapTracer, { type TracedLot } from "@/components/MapTracer";
import EstimateForm from "@/components/EstimateForm";
import EstimateSummary from "@/components/EstimateSummary";
import ClientPreview from "@/components/ClientPreview";
import QuotePdfButton from "@/components/QuotePdfButton";
import {
  computeBaselineMaterialCost,
  computeEstimate,
  DEFAULT_INPUTS,
  DEFAULT_SETTINGS,
} from "@/lib/estimation";

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export default function DashboardPage() {
  const [propertyAddress, setPropertyAddress] = useState("");
  const [tracedLot, setTracedLot] = useState<TracedLot | null>(null);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const handleLotTraced = (lot: TracedLot | null) => {
    setTracedLot(lot);
    if (lot) {
      const sqFt = Math.round(lot.areaSqFt);
      setInputs((prev) => ({
        ...prev,
        totalSqFt: sqFt,
        // Auto-fill the material lump sum baseline from the traced size -
        // the estimator can still type over it afterward.
        materialLumpSum: computeBaselineMaterialCost(sqFt, settings),
      }));
    }
  };

  const breakdown = useMemo(
    () => computeEstimate(inputs, settings),
    [inputs, settings]
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lockhart-asphalt p-6 text-center text-neutral-200">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold text-lockhart-yellow">
            Missing Google Maps API key
          </h1>
          <p className="text-sm">
            Set <code className="text-lockhart-yellow">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </code>{" "}
            in <code>.env.local</code> (see <code>.env.example</code>) and
            enable the Maps JavaScript API, Places API, and Static Maps API
            for that key, then restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-neutral-100 lg:flex-row">
      {/* Map pane */}
      <div className="h-[45vh] w-full lg:h-screen lg:w-1/2 lg:sticky lg:top-0">
        <MapTracer
          apiKey={GOOGLE_MAPS_API_KEY}
          onLotTraced={handleLotTraced}
          onAddressSelected={setPropertyAddress}
        />
      </div>

      {/* Dashboard pane */}
      <div className="w-full space-y-4 p-4 lg:w-1/2 lg:overflow-y-auto lg:p-6">
        <header>
          <h1 className="text-xl font-bold text-lockhart-asphalt">
            Lockhart Surface Solutions
          </h1>
          <p className="text-sm text-neutral-500">Field Quote Generator</p>
        </header>

        {/* ESTIMATOR VIEW - internal only. Everything in this section (raw
            costs, labor rate, markup) is for the Estimator's eyes only and
            must never be exposed in the Property Owner View below. */}
        <section aria-label="Estimator View (internal)" className="space-y-4">
          <span className="inline-block rounded-full bg-neutral-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-lockhart-yellow">
            Estimator View - internal only
          </span>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Project / Property Address
            </span>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="Search on the map, or type it here"
              className="w-full rounded-md border border-neutral-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
            />
          </label>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <EstimateForm
              inputs={inputs}
              onChange={setInputs}
              settings={settings}
              onSettingsChange={setSettings}
            />
          </div>

          <EstimateSummary breakdown={breakdown} />
        </section>

        {/* PROPERTY OWNER VIEW - only the services list and one lump-sum
            total ever render here or in the exported PDF. No labor rate,
            material cost, or markup. */}
        <section aria-label="Property Owner View" className="space-y-3 pt-2">
          <span className="inline-block rounded-full bg-lockhart-yellow px-3 py-1 text-xs font-semibold uppercase tracking-wide text-lockhart-asphalt">
            Property Owner View - what the client sees
          </span>
          <ClientPreview breakdown={breakdown} propertyAddress={propertyAddress} />
          <QuotePdfButton
            apiKey={GOOGLE_MAPS_API_KEY}
            propertyAddress={propertyAddress}
            tracedLot={tracedLot}
            breakdown={breakdown}
          />
        </section>
      </div>
    </main>
  );
}
