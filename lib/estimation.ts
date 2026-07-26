// Pure calculation logic for the "ultra-simple" estimator: the Estimator
// types two lump-sum totals (materials, labor) and a markup instead of doing
// per-gallon or per-hour math, and the app suggests a Final Quoted Price
// they can type over. Kept free of React so it can be unit tested and
// reused by the live dashboard, the Property Owner preview, and the PDF
// export without duplicating the math in three places.

export type MarkupMode = "percent" | "flat";

export interface EstimateSettings {
  /** Default $/sq ft used to auto-fill a baseline material cost when a lot
   * is traced. Purely a starting point - the Estimator can type over it. */
  sealcoatRatePerSqFt: number;
  markupMode: MarkupMode;
  /** Interpreted as a percentage when markupMode is "percent", or a flat
   * dollar amount when markupMode is "flat". */
  markupValue: number;
}

export const DEFAULT_SETTINGS: EstimateSettings = {
  sealcoatRatePerSqFt: 0.15,
  markupMode: "percent",
  markupValue: 30,
};

export interface EstimateInputs {
  totalSqFt: number;
  numberOfSpaces: number;
  materialLumpSum: number;
  laborLumpSum: number;
  /** Set once the Estimator types over the suggested final price; null
   * means "still using the auto-calculated suggestion." */
  finalPriceOverride: number | null;
}

export const DEFAULT_INPUTS: EstimateInputs = {
  totalSqFt: 0,
  numberOfSpaces: 0,
  materialLumpSum: 0,
  laborLumpSum: 0,
  finalPriceOverride: null,
};

export interface EstimateBreakdown {
  /** Internal, cost-basis numbers - the Estimator's real math. For the
   * Estimator's eyes only, never rendered in the Property Owner view or PDF. */
  internal: {
    cost: number; // materialLumpSum + laborLumpSum
    markupAmount: number;
    suggestedFinalPrice: number;
    finalPrice: number; // override if set, else suggestedFinalPrice
    isOverridden: boolean;
    profit: number; // finalPrice - cost
  };
  /**
   * Plain service names the Property Owner's PDF lists (e.g. "Sealcoating",
   * "Striping") - no dollar amount attached to any individual service.
   */
  services: string[];
  /** The single lump-sum total the Property Owner sees. */
  finalPrice: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Suggested baseline material lump sum to auto-fill right after a trace. */
export function computeBaselineMaterialCost(
  totalSqFt: number,
  settings: EstimateSettings
): number {
  return Math.round(totalSqFt * settings.sealcoatRatePerSqFt);
}

export function computeMarkupAmount(
  cost: number,
  settings: EstimateSettings
): number {
  return settings.markupMode === "percent"
    ? cost * (settings.markupValue / 100)
    : settings.markupValue;
}

export function computeSuggestedFinalPrice(
  inputs: EstimateInputs,
  settings: EstimateSettings
): number {
  const cost = inputs.materialLumpSum + inputs.laborLumpSum;
  return cost + computeMarkupAmount(cost, settings);
}

export function computeEstimate(
  inputs: EstimateInputs,
  settings: EstimateSettings
): EstimateBreakdown {
  const cost = inputs.materialLumpSum + inputs.laborLumpSum;
  const markupAmount = computeMarkupAmount(cost, settings);
  const suggestedFinalPrice = round2(cost + markupAmount);
  const finalPrice = round2(inputs.finalPriceOverride ?? suggestedFinalPrice);

  const services = ["Sealcoating"];
  if (inputs.numberOfSpaces > 0) {
    services.push("Striping");
  }

  return {
    internal: {
      cost: round2(cost),
      markupAmount: round2(markupAmount),
      suggestedFinalPrice,
      finalPrice,
      isOverridden: inputs.finalPriceOverride !== null,
      profit: round2(finalPrice - cost),
    },
    services,
    finalPrice,
  };
}

/** Converts a Google Maps geometry area (square meters) to square feet. */
export function squareMetersToSquareFeet(squareMeters: number): number {
  return squareMeters * 10.76391;
}
