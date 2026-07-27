'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Settings, FileText, DollarSign, MapPin, Hash, Percent } from 'lucide-react';
import SettingsModal from './SettingsModal';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface AppSettings {
  sealcoatRatePerSqFt: number;
  markupPercent: number;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  sealcoatRatePerSqFt: 0.15,
  markupPercent: 30,
  companyName: 'Lockhart Surface Solutions',
  companyPhone: '(512) 555-0199',
  companyEmail: 'quotes@lockhartsurface.com',
};

interface EstimatorFormProps {
  squareFootage: number;
  onSquareFootageChange: (v: number) => void;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  finalQuote: number;
  onFinalQuoteChange: (v: number) => void;
  clientName: string;
  onClientNameChange: (v: string) => void;
  projectAddress: string;
  onProjectAddressChange: (v: string) => void;
  numSpaces: number;
  onNumSpacesChange: (v: number) => void;
}

export default function EstimatorForm({
  squareFootage,
  onSquareFootageChange,
  settings,
  onSettingsChange,
  finalQuote,
  onFinalQuoteChange,
  clientName,
  onClientNameChange,
  projectAddress,
  onProjectAddressChange,
  numSpaces,
  onNumSpacesChange,
}: EstimatorFormProps) {
  const [materialCost, setMaterialCost] = useState<number | ''>('');
  const [laborCost, setLaborCost] = useState<number | ''>('');
  const [showSettings, setShowSettings] = useState(false);
  const [notes, setNotes] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  // Generated only client-side, right before export (see doExportPDF) -
  // never during render, so the prerendered/static HTML and the client's
  // hydration pass always agree (Date.now() in render causes a guaranteed
  // server/client mismatch since the two evaluations happen at different times).
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  // Same reasoning as quoteNumber above: this is a static export built once
  // and served to everyone, so a build-time Date() baked into the
  // prerendered HTML will disagree with the client's hydration-time Date()
  // whenever the build server's timezone and the visitor's local timezone
  // land on different calendar days - a guaranteed hydration mismatch, not
  // just a flaky one.
  const [todayLabel, setTodayLabel] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const autoSealcoatCost = squareFootage * settings.sealcoatRatePerSqFt;
  const totalCosts = (Number(materialCost) || 0) + (Number(laborCost) || 0) + autoSealcoatCost;
  const suggestedQuote = totalCosts * (1 + settings.markupPercent / 100);

  useEffect(() => {
    if (squareFootage > 0) {
      onFinalQuoteChange(Math.round(suggestedQuote));
    }
  }, [squareFootage, materialCost, laborCost, settings, suggestedQuote, onFinalQuoteChange]);

  const profit = finalQuote - totalCosts;
  const profitMargin = finalQuote > 0 ? ((profit / finalQuote) * 100).toFixed(1) : '0';

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // Separate from fmt() above: that one rounds to whole dollars, which is
  // fine for quote totals but would display the $/sq ft rate (e.g. $0.15)
  // as "$0".
  const fmtRate = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

  // The Sealcoating line always carries the full quote unless there's also a
  // Striping line, in which case it splits 70/30. Rounding sealcoatAmount
  // first and taking stripingAmount as the exact remainder (rather than
  // rounding both independently) keeps the two displayed line items
  // summing to exactly the displayed total - independent rounding can
  // otherwise land both lines on the same side and be $1 off.
  const roundedFinalQuote = Math.round(finalQuote);
  const sealcoatAmount = numSpaces > 0 ? Math.round(roundedFinalQuote * 0.7) : roundedFinalQuote;
  const stripingAmount = roundedFinalQuote - sealcoatAmount;

  const doExportPDF = async () => {
    setIsExporting(true);
    try {
      setQuoteNumber(`LSS-${Date.now().toString().slice(-6)}`);
      setTodayLabel(
        new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      );

      // Two animation frames reliably land after React's commit + paint for
      // the state updates above.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      if (!pdfRef.current) return;
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'letter');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const iw = pw - 20;
      const ih = (canvas.height * iw) / canvas.width;
      let left = ih;
      let pos = 10;
      pdf.addImage(imgData, 'PNG', 10, pos, iw, ih);
      left -= ph - 20;
      while (left > 0) {
        pos = left - ih + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, pos, iw, ih);
        left -= ph - 20;
      }
      const d = new Date().toISOString().split('T')[0];
      pdf.save(`Lockhart-Quote-${d}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Estimator</h2>
        <button
          onClick={() => setShowSettings(true)}
          className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Job Details
        </h3>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-1">
            <MapPin className="w-4 h-4" /> Project Address
          </label>
          <input
            type="text"
            value={projectAddress}
            onChange={(e) => onProjectAddressChange(e.target.value)}
            placeholder="123 Main St, Lockhart, TX"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Client Name</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            placeholder="John Smith"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Total Square Footage</label>
          <input
            type="number"
            min="0"
            value={squareFootage || ''}
            onChange={(e) => onSquareFootageChange(Number(e.target.value) || 0)}
            placeholder="e.g. 12000"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-1">
            <Hash className="w-4 h-4" /> Number of Spaces to Stripe
          </label>
          <input
            type="number"
            min="0"
            value={numSpaces || ''}
            onChange={(e) => onNumSpacesChange(Number(e.target.value) || 0)}
            placeholder="e.g. 50"
            className="input-field"
          />
        </div>
      </div>

      <div className="card space-y-4 border-amber-200 bg-amber-50/50">
        <h3 className="font-semibold text-amber-800 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Internal Costs
          <span className="text-xs font-normal text-amber-600 ml-auto bg-amber-200 px-2 py-0.5 rounded-full">
            HIDDEN FROM CLIENT
          </span>
        </h3>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Auto Sealcoat ({fmtRate(settings.sealcoatRatePerSqFt)}/sq ft)
          </label>
          <div className="input-field bg-slate-100 text-slate-500 flex items-center">
            {squareFootage > 0 ? fmt(autoSealcoatCost) : '—'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Lump Sum Material Cost</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">$</span>
            <input
              type="number"
              min="0"
              value={materialCost}
              onChange={(e) => setMaterialCost(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="450"
              className="input-field pl-10"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Lump Sum Labor Cost</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">$</span>
            <input
              type="number"
              min="0"
              value={laborCost}
              onChange={(e) => setLaborCost(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="300"
              className="input-field pl-10"
            />
          </div>
        </div>
        <div className="pt-2 border-t border-amber-200">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Total Costs:</span>
            <span className="font-semibold text-slate-800">{fmt(totalCosts)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-600">Profit Margin:</span>
            <span className="font-semibold text-green-700">{profitMargin}%</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-600">Est. Profit:</span>
            <span className="font-semibold text-green-700">{fmt(profit)}</span>
          </div>
        </div>
      </div>

      <div className="card bg-green-50 border-green-200 space-y-3">
        <h3 className="font-semibold text-green-800 flex items-center gap-2">
          <Percent className="w-4 h-4" /> Final Quote Price
        </h3>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 text-xl font-bold">$</span>
          <input
            type="number"
            min="0"
            value={finalQuote}
            onChange={(e) => onFinalQuoteChange(Number(e.target.value) || 0)}
            className="w-full pl-10 pr-4 py-4 text-2xl font-bold bg-white border-2 border-green-300 rounded-xl focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100 text-green-900"
          />
        </div>
        <p className="text-xs text-green-700">
          Suggested: {fmt(suggestedQuote)}. Override as needed before sending to client.
        </p>
      </div>

      <div className="card">
        <label className="block text-sm font-medium text-slate-600 mb-1">Internal Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Job specifics, access issues, etc."
          rows={3}
          className="input-field resize-none"
        />
      </div>

      <button
        onClick={doExportPDF}
        disabled={squareFootage === 0 || finalQuote === 0 || isExporting}
        className="btn-primary text-xl py-5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <FileText className="w-6 h-6" />
        {isExporting ? 'Generating PDF...' : 'Export Quote PDF'}
      </button>

      {/* Hidden PDF Template */}
      <div style={{ position: 'absolute', left: '-9999px', width: '800px' }}>
        <div ref={pdfRef} style={{ background: '#fff', fontFamily: 'Helvetica, Arial, sans-serif', color: '#1e293b' }}>
          <div style={{ background: '#1e40af', color: '#fff', padding: '30px 40px' }}>
            <h1 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>{settings.companyName}</h1>
            <p style={{ margin: '8px 0 0', fontSize: '14px', opacity: 0.9 }}>Professional Asphalt Maintenance & Striping</p>
            <div style={{ marginTop: '12px', fontSize: '13px', opacity: 0.85 }}>
              {settings.companyPhone} &nbsp;|&nbsp; {settings.companyEmail}
            </div>
          </div>

          <div style={{ padding: '30px 40px', borderBottom: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '24px', margin: '0 0 8px', color: '#1e40af' }}>QUOTE</h2>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Date: {todayLabel ?? '—'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
                  Quote #: {quoteNumber ?? '—'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Prepared For:</p>
                <p style={{ margin: '4px 0 0', fontSize: '16px' }}>{clientName || 'Client'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>{projectAddress || 'Address TBD'}</p>
              </div>
            </div>
          </div>

          <div style={{ padding: '20px 40px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1e40af' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '14px', color: '#1e40af' }}>Item</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '14px', color: '#1e40af' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '14px', color: '#1e40af' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '16px 8px', fontSize: '14px', fontWeight: 500 }}>1</td>
                  <td style={{ padding: '16px 8px', fontSize: '14px' }}>
                    <strong>Sealcoating Service</strong><br />
                    <span style={{ color: '#64748b', fontSize: '13px' }}>
                      Professional asphalt sealcoating for approximately {squareFootage.toLocaleString()} sq ft
                    </span>
                  </td>
                  <td style={{ padding: '16px 8px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>
                    {fmt(sealcoatAmount)}
                  </td>
                </tr>
                {numSpaces > 0 && (
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '16px 8px', fontSize: '14px', fontWeight: 500 }}>2</td>
                    <td style={{ padding: '16px 8px', fontSize: '14px' }}>
                      <strong>Striping Service</strong><br />
                      <span style={{ color: '#64748b', fontSize: '13px' }}>
                        Parking lot line striping — {numSpaces} spaces
                      </span>
                    </td>
                    <td style={{ padding: '16px 8px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>
                      {fmt(stripingAmount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ marginTop: '24px', padding: '20px', background: '#f1f5f9', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Total Quote</span>
                <span style={{ fontSize: '28px', fontWeight: 700, color: '#1e40af' }}>{fmt(finalQuote)}</span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b' }}>
                * Valid for 30 days. Price subject to change based on final site conditions.
              </p>
            </div>
          </div>

          <div style={{ padding: '20px 40px 40px', borderTop: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Terms & Conditions</h3>
            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              1. Payment terms: Net 15 upon completion.<br />
              2. Weather delays: Work may be rescheduled due to rain or temperatures below 50°F.<br />
              3. Site access: Client must ensure clear access to work area.<br />
              4. This quote is an estimate based on the square footage provided; final pricing may vary after on-site inspection.
            </p>
            <div style={{ marginTop: '40px', display: 'flex', gap: '40px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ borderBottom: '1px solid #94a3b8', height: '40px' }}></div>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Client Signature</p>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ borderBottom: '1px solid #94a3b8', height: '40px' }}></div>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Date</p>
              </div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px 40px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
            {settings.companyName} — Licensed & Insured — Thank you for your business!
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={onSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
