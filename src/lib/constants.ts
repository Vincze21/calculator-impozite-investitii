import type { FiscalYear } from '@/types/tax';

// Salariu minim brut pe economie
export const SMB: Record<number, number> = {
  2025: 4050,
  2026: 4050, // din iulie 2026 = 4325, dar plafoanele CASS se calculeaza cu val. din 1 ianuarie
};

// CASS
export const CASS_RATE = 0.10;
export const CASS_MULTIPLIERS = [6, 12, 24] as const;

export function getCassThresholds(year: FiscalYear): [number, number, number] {
  const smb = SMB[year];
  const annual = 12 * smb;
  return [
    CASS_MULTIPLIERS[0] * annual / 12, // 6 × SMB = 24300
    CASS_MULTIPLIERS[1] * annual / 12, // 12 × SMB = 48600
    CASS_MULTIPLIERS[2] * annual / 12, // 24 × SMB = 97200
  ];
}

// Cote impozit pe castiguri de capital — broker REZIDENT (retinut la sursa per tranzactie)
export const RATES_RESIDENT: Record<FiscalYear, { long: number; short: number }> = {
  2025: { long: 0.01, short: 0.03 }, // long = detinere >= 365 zile
  2026: { long: 0.03, short: 0.06 },
};

// Cote impozit pe castiguri de capital — broker NEREZIDENT (auto-impunere D212)
export const RATES_NONRESIDENT: Record<FiscalYear, number> = {
  2025: 0.10,
  2026: 0.16,
};

// Impozit pe dividende
export const DIVIDEND_TAX: Record<number, number> = {
  2023: 0.08,
  2024: 0.08,
  2025: 0.10,
  2026: 0.16,
};

// WHT (Withholding Tax) pe tari — ratele din tratate, pentru dividende
export const WHT_RATES: Record<string, number | { withW8BEN: number; without: number } | { ucits: number; direct: number } | { fund: number; direct: number }> = {
  US: { withW8BEN: 0.10, without: 0.30 },
  IE: { ucits: 0.00, direct: 0.03 },
  LU: { fund: 0.00, direct: 0.15 },
  DE: 0.15,
  UK: 0.00,
  NL: 0.15,
  FR: 0.10,
  AT: 0.05,
};

// Termenele D212
export const DEADLINES: Record<string, { filing: string; payment: string }> = {
  venituri_2025: { filing: '2026-05-25', payment: '2026-05-25' },
  venituri_2026: { filing: '2027-05-25', payment: '2027-05-25' },
};

// Compensare pierderi
export const LOSS_CARRY = {
  post2024: { years: 5, maxCompensationRate: 0.70 },
  pre2024: { years: 7, maxCompensationRate: null as number | null },
};

// Crypto prag neimpozabil
export const CRYPTO_EXEMPT = {
  perTransaction: 200, // lei
  annualTotal: 600,     // lei
};

// Tari cu nume (pentru D212)
export const COUNTRY_NAMES: Record<string, string> = {
  US: 'Statele Unite ale Americii',
  IE: 'Irlanda',
  LU: 'Luxemburg',
  DE: 'Germania',
  UK: 'Regatul Unit',
  NL: 'Olanda',
  FR: 'Franta',
  AT: 'Austria',
  CH: 'Elvetia',
  CA: 'Canada',
  JP: 'Japonia',
  AU: 'Australia',
};
