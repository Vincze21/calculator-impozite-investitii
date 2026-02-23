export type InstrumentType =
  | 'stock'
  | 'etf_acc'
  | 'etf_dist'
  | 'bond_gov'
  | 'bond_corp'
  | 'option'
  | 'future'
  | 'cfd'
  | 'mutual_fund'
  | 'crypto';

export interface NormalizedTransaction {
  id: string;
  date: Date;
  type: 'buy' | 'sell';
  symbol: string;
  isin?: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  commission: number;
  currency: string;
  exchangeRate?: number;
  instrumentType: InstrumentType;
}

export interface NormalizedDividend {
  id: string;
  date: Date;
  symbol: string;
  grossAmount: number;
  whtAmount: number;
  netAmount: number;
  currency: string;
  country: string;
  sourceBrokerId?: string;
}

export interface NormalizedInterest {
  id: string;
  date: Date;
  grossAmount: number;
  whtAmount: number;
  currency: string;
  source: 'bond_coupon' | 'cash_interest' | 'other';
}

export interface OtherIncome {
  cryptoGains: number;
  rentalIncome: number;
  interestIncome: number;
  otherIncome: number;
  govBondIncome: number;
}

export interface ParseResult {
  broker: string;
  transactions: NormalizedTransaction[];
  dividends: NormalizedDividend[];
  interests: NormalizedInterest[];
  warnings: string[];
  currency: string;
  period: { from: Date; to: Date };
}
