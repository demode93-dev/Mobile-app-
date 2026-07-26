"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import type { EstimateBreakdown } from "@/lib/estimation";
import { buildStaticMapUrl, fetchImageAsDataUrl } from "@/lib/staticMap";
import type { TracedLot } from "./MapTracer";

interface QuotePdfButtonProps {
  apiKey: string;
  clientAddress: string;
  tracedLot: TracedLot | null;
  breakdown: EstimateBreakdown;
}

const PAGE_WIDTH = 612; // US Letter, points
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const BRAND_DARK = "#1c1917";
const BRAND_YELLOW = "#f5b400";

function currency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

async function buildQuotePdf({
  apiKey,
  clientAddress,
  tracedLot,
  breakdown,
}: QuotePdfButtonProps): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const quoteNumber = `LSS-${Date.now().toString().slice(-8)}`;

  // ---- Branded header band ----------------------------------------------
  doc.setFillColor(BRAND_DARK);
  doc.rect(0, 0, PAGE_WIDTH, 96, "F");

  doc.setTextColor(BRAND_YELLOW);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("LOCKHART SURFACE SOLUTIONS", MARGIN, 42);

  doc.setTextColor("#e7e5e4");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Professional Seal Coating & Line Striping", MARGIN, 60);

  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("QUOTE", PAGE_WIDTH - MARGIN, 38, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Quote #${quoteNumber}`, PAGE_WIDTH - MARGIN, 54, {
    align: "right",
  });
  doc.text(today, PAGE_WIDTH - MARGIN, 68, { align: "right" });

  let cursorY = 128;

  // ---- Project address ----------------------------------------------------
  doc.setTextColor(BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Project Address", MARGIN, cursorY);
  cursorY += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(clientAddress || "Address not provided", MARGIN, cursorY);
  cursorY += 24;

  // ---- Traced lot snapshot --------------------------------------------
  if (tracedLot) {
    try {
      const staticMapUrl = buildStaticMapUrl(tracedLot.path, apiKey);
      const dataUrl = await fetchImageAsDataUrl(staticMapUrl);
      const imageHeight = 200;
      doc.addImage(
        dataUrl,
        "PNG",
        MARGIN,
        cursorY,
        CONTENT_WIDTH,
        imageHeight
      );
      cursorY += imageHeight + 8;
      doc.setFontSize(9);
      doc.setTextColor("#78716c");
      doc.text(
        `Traced quoted area: ${Math.round(
          tracedLot.areaSqFt
        ).toLocaleString()} sq ft`,
        MARGIN,
        cursorY
      );
      cursorY += 20;
    } catch (err) {
      // If the Static Maps request fails (bad key, offline, quota), the
      // quote still generates - it just skips the image instead of
      // producing a blank box.
      console.warn("Could not fetch map snapshot for PDF:", err);
    }
  }

  // ---- Line items table -------------------------------------------------
  doc.setTextColor(BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Service", MARGIN, cursorY);
  doc.text("Price", PAGE_WIDTH - MARGIN, cursorY, { align: "right" });
  cursorY += 6;
  doc.setDrawColor(BRAND_DARK);
  doc.setLineWidth(1);
  doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY);
  cursorY += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  breakdown.customer.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor("#f5f5f4");
      doc.rect(MARGIN, cursorY - 14, CONTENT_WIDTH, 22, "F");
    }
    doc.setTextColor(BRAND_DARK);
    doc.text(item.label, MARGIN + 6, cursorY);
    doc.text(currency(item.amount), PAGE_WIDTH - MARGIN - 6, cursorY, {
      align: "right",
    });
    cursorY += 22;
  });

  cursorY += 4;
  doc.setLineWidth(1.5);
  doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY);
  cursorY += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total Investment", MARGIN, cursorY);
  doc.text(currency(breakdown.customerTotal), PAGE_WIDTH - MARGIN, cursorY, {
    align: "right",
  });
  cursorY += 36;

  // ---- Terms & conditions -------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Terms & Conditions", MARGIN, cursorY);
  cursorY += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#57534e");
  const termsPlaceholder =
    "[Insert Lockhart Surface Solutions standard terms here: quote validity period, weather-delay policy, payment schedule, warranty coverage, and cancellation terms.] This quote is valid for 30 days from the date above and is based on the site conditions observed at the time of the estimate.";
  const termsLines = doc.splitTextToSize(termsPlaceholder, CONTENT_WIDTH);
  doc.text(termsLines, MARGIN, cursorY);
  cursorY += termsLines.length * 12 + 28;

  // ---- Signature line -----------------------------------------------------
  doc.setDrawColor("#a8a29e");
  doc.setLineWidth(0.75);
  doc.line(MARGIN, cursorY, MARGIN + 260, cursorY);
  doc.line(MARGIN + 300, cursorY, PAGE_WIDTH - MARGIN, cursorY);
  cursorY += 14;
  doc.setFontSize(9);
  doc.setTextColor(BRAND_DARK);
  doc.text("Authorized Signature", MARGIN, cursorY);
  doc.text("Date", MARGIN + 300, cursorY);

  return doc;
}

export default function QuotePdfButton(props: QuotePdfButtonProps) {
  const [status, setStatus] = useState<"idle" | "generating" | "error">(
    "idle"
  );

  const handleExport = async () => {
    setStatus("generating");
    try {
      const doc = await buildQuotePdf(props);
      const addressSlug = (props.clientAddress || "quote")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
      doc.save(`lockhart-quote-${addressSlug || "untitled"}.pdf`);
      setStatus("idle");
    } catch (err) {
      console.error("Failed to generate PDF quote:", err);
      setStatus("error");
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={status === "generating"}
        className="w-full rounded-md bg-lockhart-yellow px-4 py-3 text-sm font-semibold text-lockhart-asphalt shadow-sm transition hover:brightness-95 disabled:opacity-60"
      >
        {status === "generating" ? "Generating PDF..." : "Export to PDF"}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-600">
          Something went wrong generating the PDF. Check the console for
          details and try again.
        </p>
      )}
    </div>
  );
}
