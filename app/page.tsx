"use client";

import { useMemo, useState } from "react";
import MapTracer, { type TracedLot } from "@/components/MapTracer";
import EstimateForm from "@/components/EstimateForm";
import EstimateSummary from "@/components/EstimateSummary";
import QuotePdfButton from "@/components/QuotePdfButton";
import { computeEstimate, DEFAULT_INPUTS } from "@/lib/estimation";

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export default function DashboardPage() {
  const [clientAddress, setClientAddress] = useState("");
  const [tracedLot, setTracedLot] = useState<TracedLot | null>(null);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);

  const handleLotTraced = (lot: TracedLot | null) => {
    setTracedLot(lot);
    if (lot) {
      setInputs((prev) => ({ ...prev, totalSqFt: Math.round(lot.areaSqFt) }));
    }
  };

  const breakdown = useMemo(() => computeEstimate(inputs), [inputs]);

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
          onAddressSelected={setClientAddress}
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

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Project / Client Address
          </span>
          <input
            type="text"
            value={clientAddress}
            onChange={(e) => setClientAddress(e.target.value)}
            placeholder="Search on the map, or type it here"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lockhart-yellow"
          />
        </label>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <EstimateForm
            inputs={inputs}
            onChange={setInputs}
            autoSqFt={tracedLot?.areaSqFt ?? null}
          />
        </div>

        <EstimateSummary breakdown={breakdown} />

        <QuotePdfButton
          apiKey={GOOGLE_MAPS_API_KEY}
          clientAddress={clientAddress}
          tracedLot={tracedLot}
          breakdown={breakdown}
        />
      </div>
    </main>
  );
}
