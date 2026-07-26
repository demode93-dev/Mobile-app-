// Pure calculation logic for the estimation engine. Kept free of React so it
// can be unit tested and reused by both the live dashboard and the PDF export
// without duplicating the math in two places.

export type StripingUnit = "spaces" | "linearFeet";
export type SealantPricingMode = "perSqFt" | "perGallon";
export type LaborMode = "perHour" | "perSqFt";

export interface EstimateInputs {
  totalSqFt: number;
  prepCostPerSqFt: number;

  sealantPricingMode: SealantPricingMode;
  sealantCostPerSqFt: number; // used when sealantPricingMode === "perSqFt"
  sealantCostPerGallon: number; // used when sealantPricingMode === "perGallon"
  sealantCoverageSqFtPerGallon: number; // used when sealantPricingMode === "perGallon"

  stripingUnit: StripingUnit;
  stripingQuantity: number; // number of spaces, or linear feet
  paintCostPerUnit: number; // $ per space or per linear foot

  laborMode: LaborMode;
  laborRate: number; // $/hr or $/sqft depending on laborMode
  laborHours: number; // used when laborMode === "perHour"

  marginPercent: number;
}

export interface EstimateLineItem {
  label: string;
  amount: number;
}

export interface EstimateBreakdown {
  /** Internal, cost-basis line items - the estimator's real numbers. */
  internal: {
    prep: number;
    sealCoat: number;
    striping: number;
    labor: number;
    subtotal: number;
    marginAmount: number;
    total: number;
  };
  /**
   * Customer-facing line items with margin baked proportionally into each
   * service price. Labor is folded into "Seal Coating" rather than shown as
   * its own line, so the client sees finished service prices, not a labor
   * rate or the markup percentage.
   */
  customer: EstimateLineItem[];
  customerTotal: number;
}

export const DEFAULT_INPUTS: EstimateInputs = {
  totalSqFt: 0,
  prepCostPerSqFt: 0.04,

  sealantPricingMode: "perSqFt",
  sealantCostPerSqFt: 0.18,
  sealantCostPerGallon: 28,
  sealantCoverageSqFtPerGallon: 80,

  stripingUnit: "spaces",
  stripingQuantity: 0,
  paintCostPerUnit: 6,

  laborMode: "perSqFt",
  laborRate: 0.05,
  laborHours: 0,

  marginPercent: 25,
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeSealCoatCost(inputs: EstimateInputs): number {
  const { totalSqFt, sealantPricingMode } = inputs;
  if (sealantPricingMode === "perSqFt") {
    return totalSqFt * inputs.sealantCostPerSqFt;
  }
  const coverage = inputs.sealantCoverageSqFtPerGallon || 1;
  const gallonsNeeded = totalSqFt / coverage;
  return gallonsNeeded * inputs.sealantCostPerGallon;
}

export function computeLaborCost(inputs: EstimateInputs): number {
  return inputs.laborMode === "perSqFt"
    ? inputs.totalSqFt * inputs.laborRate
    : inputs.laborHours * inputs.laborRate;
}

export function computeEstimate(inputs: EstimateInputs): EstimateBreakdown {
  const prep = inputs.totalSqFt * inputs.prepCostPerSqFt;
  const sealCoat = computeSealCoatCost(inputs);
  const striping = inputs.stripingQuantity * inputs.paintCostPerUnit;
  const labor = computeLaborCost(inputs);

  const subtotal = prep + sealCoat + striping + labor;
  const marginAmount = subtotal * (inputs.marginPercent / 100);
  const total = subtotal + marginAmount;

  // Apply the same margin multiplier to every service line so the customer
  // sees only finished prices - none of the underlying labor rate or the
  // markup percentage is exposed.
  const marginMultiplier = 1 + inputs.marginPercent / 100;
  const customer: EstimateLineItem[] = [
    {
      label: "Surface Preparation & Cleaning",
      amount: round2(prep * marginMultiplier),
    },
    {
      label: "Seal Coating Application",
      amount: round2((sealCoat + labor) * marginMultiplier),
    },
    {
      label:
        inputs.stripingUnit === "spaces"
          ? "Line Striping (Parking Spaces)"
          : "Line Striping",
      amount: round2(striping * marginMultiplier),
    },
  ];
  const customerTotal = round2(
    customer.reduce((sum, item) => sum + item.amount, 0)
  );

  return {
    internal: {
      prep: round2(prep),
      sealCoat: round2(sealCoat),
      striping: round2(striping),
      labor: round2(labor),
      subtotal: round2(subtotal),
      marginAmount: round2(marginAmount),
      total: round2(total),
    },
    customer,
    customerTotal,
  };
}

/** Converts a Google Maps geometry area (square meters) to square feet. */
export function squareMetersToSquareFeet(squareMeters: number): number {
  return squareMeters * 10.76391;
}
