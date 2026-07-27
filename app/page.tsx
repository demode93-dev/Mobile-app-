'use client';

import React, { useState } from 'react';
import EstimatorForm, { DEFAULT_SETTINGS, AppSettings } from '@/components/EstimatorForm';

export default function Home() {
  const [squareFootage, setSquareFootage] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [finalQuote, setFinalQuote] = useState(0);

  // Form state for PDF
  const [clientName, setClientName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [numSpaces, setNumSpaces] = useState(0);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-blue-800 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
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

      <div className="max-w-2xl mx-auto px-4 py-4 pb-20">
        <EstimatorForm
          squareFootage={squareFootage}
          onSquareFootageChange={setSquareFootage}
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
    </main>
  );
}
