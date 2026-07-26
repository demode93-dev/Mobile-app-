// Pure calculation logic for the "ultra-simple" estimator: the estimator
// types two lump-sum totals (materials, labor) instead of doing per-gallon
// or per-hour math, and the app suggests a final quote price they can type
// over. Kept free of React so it can be unit tested and reused by the live
// dashboard, the client preview, and the PDF export without duplicating the
// math in three places.

export type PricingMode = "markupOnCosts" | "flatRatePerSqFt";

export interface EstimateSettings {
  /** Default $/sq ft used to auto-fill a baseline material cost when a lot
   * is traced, and as the sealcoating half of "flat rate" pricing. */
  sealcoatRatePerSqFt: number;
  /** Used as the striping half of "flat rate" pricing, and to weight how
   * much of the final price the PDF attributes to striping vs sealcoating. */
  stripingRatePerSpace: number;
  /** Markup applied to the material + labor lump sums in "markupOnCosts" mode. */
  markupPercent: number;
  pricingMode: PricingMode;
}

export const DEFAULT_SETTINGS: EstimateSettings = {
  sealcoatRatePerSqFt: 0.15,
  stripingRatePerSpace: 8,
  markupPercent: 30,
  pricingMode: "markupOnCosts",
};

export interface EstimateInputs {
  totalSqFt: number;
  numberOfSpaces: number;
  materialLumpSum: number;
  laborLumpSum: number;
  /** Set once the estimator types over the suggested final price; null means
   * "still using the auto-calculated suggestion." */
  finalPriceOverride: number | null;
}

export const DEFAULT_INPUTS: EstimateInputs = {
  totalSqFt: 0,
  numberOfSpaces: 0,
  materialLumpSum: 0,
  laborLumpSum: 0,
  finalPriceOverride: null,
};

export interface EstimateLineItem {
  label: string;
  amount: number;
}

export interface EstimateBreakdown {
  /** Internal, cost-basis numbers - the estimator's real math. */
  internal: {
    cost: number; // materialLumpSum + laborLumpSum
    suggestedFinalPrice: number;
    finalPrice: number; // override if set, else suggestedFinalPrice
    isOverridden: boolean;
    profit: number; // finalPrice - cost
  };
  /**
   * Customer-facing line items that always sum to exactly `finalPrice`
   * (including when the estimator has typed over the suggestion) - no
   * labor rate, material cost, or margin ever appears here.
   */
  customer: EstimateLineItem[];
  customerTotal: number;
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

export function computeSuggestedFinalPrice(
  inputs: EstimateInputs,
  settings: EstimateSettings
): number {
  if (settings.pricingMode === "flatRatePerSqFt") {
    return (
      inputs.totalSqFt * settings.sealcoatRatePerSqFt +
      inputs.numberOfSpaces * settings.stripingRatePerSpace
    );
  }
  const cost = inputs.materialLumpSum + inputs.laborLumpSum;
  return cost * (1 + settings.markupPercent / 100);
}

export function computeEstimate(
  inputs: EstimateInputs,
  settings: EstimateSettings
): EstimateBreakdown {
  const cost = inputs.materialLumpSum + inputs.laborLumpSum;
  const suggestedFinalPrice = round2(computeSuggestedFinalPrice(inputs, settings));
  const finalPrice = round2(inputs.finalPriceOverride ?? suggestedFinalPrice);

  // Split the (possibly overridden) total into customer-friendly service
  // lines by weighting sealcoating vs striping using the settings rates -
  // those rates only decide the *ratio*, never the actual dollar amounts,
  // so the line items always add up to exactly what the estimator quoted.
  const sealcoatWeight = Math.max(inputs.totalSqFt * settings.sealcoatRatePerSqFt, 0);
  const stripingWeight = Math.max(
    inputs.numberOfSpaces * settings.stripingRatePerSpace,
    0
  );
  const totalWeight = sealcoatWeight + stripingWeight;

  const customer: EstimateLineItem[] = [];
  if (inputs.numberOfSpaces <= 0 || totalWeight === 0) {
    customer.push({ label: "1. Sealcoating Service", amount: finalPrice });
  } else {
    const sealcoatAmount = round2((finalPrice * sealcoatWeight) / totalWeight);
    customer.push({ label: "1. Sealcoating Service", amount: sealcoatAmount });
    customer.push({
      label: "2. Striping Service",
      amount: round2(finalPrice - sealcoatAmount), // exact remainder, avoids rounding drift
    });
  }

  return {
    internal: {
      cost: round2(cost),
      suggestedFinalPrice,
      finalPrice,
      isOverridden: inputs.finalPriceOverride !== null,
      profit: round2(finalPrice - cost),
    },
    customer,
    customerTotal: round2(customer.reduce((sum, item) => sum + item.amount, 0)),
  };
}

/** Converts a Google Maps geometry area (square meters) to square feet. */
export function squareMetersToSquareFeet(squareMeters: number): number {
  return squareMeters * 10.76391;
}
