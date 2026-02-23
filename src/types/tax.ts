export type FiscalYear = 2025 | 2026;

export interface MatchedLot {
  symbol: string;
  buyDate: Date;
  sellDate: Date;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  buyCommission: number;
  sellCommission: number;
  currency: string;
  exchangeRateBuy: number;
  exchangeRateSell: number;
  holdingDays: number;
  gainRON: number;
  taxRate: number;
  taxAmount: number;
}

export interface CapitalGainResult {
  brokerId: string;
  brokerType: 'resident' | 'nonresident';
  lots: MatchedLot[];
  totalGrossGain: number;
  totalLoss: number;
  netGain: number;
  carriedLossApplied: number;
  taxableGain: number;
  tax: number;
  newCarriedLoss: number;
}

export interface DividendTaxDetail {
  symbol: string;
  country: string;
  grossAmountRON: number;
  taxRO: number;
  whtRON: number;
  taxCredit: number;
  taxDue: number;
}

export interface DividendResult {
  details: DividendTaxDetail[];
  totalGrossRON: number;
  totalTaxRO: number;
  totalWHTRON: number;
  totalTaxCredit: number;
  totalTaxDue: number;
}

export interface CASSResult {
  totalNonSalaryIncome: number;
  threshold: number;
  base: number;
  amount: number;
  breakdown: {
    capitalGainsResident: number;
    capitalGainsNonResident: number;
    dividendsNet: number;
    interestNet: number;
    cryptoGains: number;
    rentalIncome: number;
    otherIncome: number;
    govBondExcluded: number;
  };
}

export interface LossCarryForward {
  year: number;
  amount: number;
  expiresYear: number;
  maxCompensation: number | null;
}

export interface TaxResult {
  fiscalYear: FiscalYear;
  capitalGains: CapitalGainResult[];
  dividends: DividendResult;
  cass: CASSResult;
  totalCapitalGainsTax: number;
  totalDividendTax: number;
  totalCASS: number;
  totalDue: number;
  d212Required: boolean;
  d212Reason: string[];
  deadline: { filing: string; payment: string };
  newCarriedLosses: LossCarryForward[];
  comparison: BrokerComparisonResult | null;
}

// ── Broker Comparator Types ──

export interface BrokerComparisonSide {
  regime: 'resident' | 'nonresident';
  label: string;
  capitalGainResult: CapitalGainResult;
  cassResult: CASSResult;
  totalCapitalGainsTax: number;
  totalCASS: number;
  totalDue: number;
  effectiveTaxRate: number;
  d212RequiredForTax: boolean;
}

export interface ComparisonInsight {
  type: 'info' | 'warning' | 'advantage';
  regime: 'resident' | 'nonresident' | 'both';
  message: string;
}

export interface BrokerComparisonResult {
  fiscalYear: FiscalYear;
  resident: BrokerComparisonSide;
  nonresident: BrokerComparisonSide;
  savings: number;
  cheaperRegime: 'resident' | 'nonresident' | 'equal';
  transactionCount: number;
  lotCount: number;
  insights: ComparisonInsight[];
}
