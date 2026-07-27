'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import EstimatorForm, { DEFAULT_SETTINGS, AppSettings } from '@/components/EstimatorForm';
import type { LatLng } from '@/lib/staticMap';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-2xl">
      <div className="text-slate-500 text-lg animate-pulse">Loading map...</div>
    </div>
  ),
});

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export default function Home() {
  const [squareFootage, setSquareFootage] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [finalQuote, setFinalQuote] = useState(0);
  const [polygonPath, setPolygonPath] = useState<LatLng[] | null>(null);

  // Form state for PDF
  const [clientName, setClientName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [numSpaces, setNumSpaces] = useState(0);

  const handleAreaCalculated = useCallback((sqFt: number) => {
    setSquareFootage(sqFt);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-blue-800 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Lockhart Surface Solutions</h1>
            <p className="text-blue-200 text-xs">Professional Estimator</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-200">Quote Total</div>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(finalQuote)}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-100px)] min-h-[600px]">
          <div className="h-[50vh] lg:h-full rounded-2xl overflow-hidden shadow-lg">
            <MapComponent
              onAreaCalculated={handleAreaCalculated}
              onPolygonChange={setPolygonPath}
            />
          </div>

          <div className="h-[50vh] lg:h-full overflow-y-auto pb-20 lg:pb-0">
            <EstimatorForm
              apiKey={GOOGLE_MAPS_API_KEY}
              squareFootage={squareFootage}
              polygonPath={polygonPath}
              settings={settings}
              onSettingsChange={setSettings}
              finalQuote={finalQuote}
              onFinalQuoteChange={setFinalQuote}
              clientName={clientName}
              onClientNameChange={setClientName}
              projectAddress={projectAddress}
              onProjectAddressChange={setProjectAddress}
              numSpaces={numSpaces}
              onNumSpacesChange={setNumSpaces}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
