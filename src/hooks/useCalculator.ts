'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NormalizedTransaction, NormalizedDividend, OtherIncome } from '@/types/transaction';
import type { BrokerConfig } from '@/types/broker';
import type { FiscalYear, TaxResult, LossCarryForward } from '@/types/tax';
import type { UserProfile } from '@/types/d212';
import { calculateTaxes } from '@/lib/tax/engine';

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface CalculatorState {
  // Wizard navigation
  currentStep: WizardStep;
  setStep: (step: WizardStep) => void;
  goNext: () => void;
  goBack: () => void;

  // Step 1: Fiscal year
  fiscalYear: FiscalYear;
  setFiscalYear: (year: FiscalYear) => void;

  // Step 2: Brokers
  brokers: BrokerConfig[];
  addBroker: (broker: BrokerConfig) => void;
  removeBroker: (id: string) => void;
  updateBroker: (id: string, updates: Partial<BrokerConfig>) => void;

  // Step 3-4: Transactions
  transactionsByBroker: Record<string, NormalizedTransaction[]>;
  setTransactionsForBroker: (brokerId: string, txs: NormalizedTransaction[]) => void;
  addTransaction: (brokerId: string, tx: NormalizedTransaction) => void;
  removeTransaction: (brokerId: string, txId: string) => void;
  updateTransaction: (brokerId: string, txId: string, updates: Partial<NormalizedTransaction>) => void;

  // Step 5: Dividends
  foreignDividends: NormalizedDividend[];
  domesticDividends: NormalizedDividend[];
  addForeignDividend: (div: NormalizedDividend) => void;
  removeForeignDividend: (id: string) => void;
  addDomesticDividend: (div: NormalizedDividend) => void;
  removeDomesticDividend: (id: string) => void;
  setForeignDividends: (divs: NormalizedDividend[]) => void;
  setDomesticDividends: (divs: NormalizedDividend[]) => void;
  mergeDividendsForBroker: (brokerId: string, type: 'foreign' | 'domestic', divs: NormalizedDividend[]) => void;
  clearDataForBroker: (brokerId: string) => void;

  // Step 6: Other income
  otherIncome: OtherIncome;
  setOtherIncome: (income: Partial<OtherIncome>) => void;

  // Carried losses from previous years
  carriedLosses: LossCarryForward[];
  setCarriedLosses: (losses: LossCarryForward[]) => void;

  // User profile (for D212)
  userProfile: UserProfile;
  setUserProfile: (profile: Partial<UserProfile>) => void;

  // Results
  results: TaxResult | null;
  calculating: boolean;
  calculate: (exchangeRates: Map<string, number>, annualAvgRates: Record<string, number>) => void;
  clearResults: () => void;

  // Reset
  reset: () => void;
}

const emptyUserProfile: UserProfile = {
  nume: '', prenume: '', initialaTata: '',
  strada: '', numar: '', bloc: '', scara: '', etaj: '', apartament: '',
  judet: '', localitate: '', codPostal: '',
  telefon: '', email: '', iban: '',
};

const emptyOtherIncome: OtherIncome = {
  cryptoGains: 0, rentalIncome: 0, interestIncome: 0, otherIncome: 0, govBondIncome: 0,
};

// Custom serializer for Date objects and Map
function serializeState(state: unknown): string {
  return JSON.stringify(state, (key, value) => {
    if (value instanceof Date) return { __type: 'Date', value: value.toISOString() };
    if (value instanceof Map) return { __type: 'Map', value: Array.from(value.entries()) };
    return value;
  });
}

function deserializeState(str: string): unknown {
  return JSON.parse(str, (key, value) => {
    if (value && typeof value === 'object' && value.__type === 'Date') return new Date(value.value);
    if (value && typeof value === 'object' && value.__type === 'Map') return new Map(value.value);
    return value;
  });
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set, get) => ({
      // Wizard
      currentStep: 1 as WizardStep,
      setStep: (step) => set({ currentStep: step }),
      goNext: () => set((s) => ({ currentStep: Math.min(7, s.currentStep + 1) as WizardStep })),
      goBack: () => set((s) => ({ currentStep: Math.max(1, s.currentStep - 1) as WizardStep })),

      // Year
      fiscalYear: 2025 as FiscalYear,
      setFiscalYear: (year) => set({ fiscalYear: year }),

      // Brokers
      brokers: [],
      addBroker: (broker) => set((s) => ({ brokers: [...s.brokers, broker] })),
      removeBroker: (id) => set((s) => ({
        brokers: s.brokers.filter(b => b.id !== id),
        transactionsByBroker: Object.fromEntries(
          Object.entries(s.transactionsByBroker).filter(([k]) => k !== id)
        ),
      })),
      updateBroker: (id, updates) => set((s) => ({
        brokers: s.brokers.map(b => b.id === id ? { ...b, ...updates } : b),
      })),

      // Transactions
      transactionsByBroker: {},
      setTransactionsForBroker: (brokerId, txs) => set((s) => ({
        transactionsByBroker: { ...s.transactionsByBroker, [brokerId]: txs },
      })),
      addTransaction: (brokerId, tx) => set((s) => ({
        transactionsByBroker: {
          ...s.transactionsByBroker,
          [brokerId]: [...(s.transactionsByBroker[brokerId] ?? []), tx],
        },
      })),
      removeTransaction: (brokerId, txId) => set((s) => ({
        transactionsByBroker: {
          ...s.transactionsByBroker,
          [brokerId]: (s.transactionsByBroker[brokerId] ?? []).filter(t => t.id !== txId),
        },
      })),
      updateTransaction: (brokerId, txId, updates) => set((s) => ({
        transactionsByBroker: {
          ...s.transactionsByBroker,
          [brokerId]: (s.transactionsByBroker[brokerId] ?? []).map(t =>
            t.id === txId ? { ...t, ...updates } : t
          ),
        },
      })),

      // Dividends
      foreignDividends: [],
      domesticDividends: [],
      addForeignDividend: (div) => set((s) => ({ foreignDividends: [...s.foreignDividends, div] })),
      removeForeignDividend: (id) => set((s) => ({ foreignDividends: s.foreignDividends.filter(d => d.id !== id) })),
      addDomesticDividend: (div) => set((s) => ({ domesticDividends: [...s.domesticDividends, div] })),
      removeDomesticDividend: (id) => set((s) => ({ domesticDividends: s.domesticDividends.filter(d => d.id !== id) })),
      setForeignDividends: (divs) => set({ foreignDividends: divs }),
      setDomesticDividends: (divs) => set({ domesticDividends: divs }),
      mergeDividendsForBroker: (brokerId, type, divs) => set((s) => {
        const tagged = divs.map(d => ({ ...d, sourceBrokerId: brokerId }));
        if (type === 'foreign') {
          const kept = s.foreignDividends.filter(d => d.sourceBrokerId !== brokerId);
          return { foreignDividends: [...kept, ...tagged] };
        } else {
          const kept = s.domesticDividends.filter(d => d.sourceBrokerId !== brokerId);
          return { domesticDividends: [...kept, ...tagged] };
        }
      }),
      clearDataForBroker: (brokerId) => set((s) => ({
        transactionsByBroker: { ...s.transactionsByBroker, [brokerId]: [] },
        foreignDividends: s.foreignDividends.filter(d => d.sourceBrokerId !== brokerId),
        domesticDividends: s.domesticDividends.filter(d => d.sourceBrokerId !== brokerId),
      })),

      // Other income
      otherIncome: { ...emptyOtherIncome },
      setOtherIncome: (income) => set((s) => ({ otherIncome: { ...s.otherIncome, ...income } })),

      // Carried losses
      carriedLosses: [],
      setCarriedLosses: (losses) => set({ carriedLosses: losses }),

      // User profile
      userProfile: { ...emptyUserProfile },
      setUserProfile: (profile) => set((s) => ({ userProfile: { ...s.userProfile, ...profile } })),

      // Results
      results: null,
      calculating: false,
      calculate: (exchangeRates, annualAvgRates) => {
        const state = get();
        set({ calculating: true });
        try {
          const result = calculateTaxes({
            fiscalYear: state.fiscalYear,
            brokers: state.brokers,
            transactionsByBroker: state.transactionsByBroker,
            foreignDividends: state.foreignDividends,
            domesticDividends: state.domesticDividends,
            otherIncome: state.otherIncome,
            carriedLosses: state.carriedLosses,
            exchangeRates,
            annualAvgRates,
          });
          set({ results: result, calculating: false });
        } catch (error) {
          console.error('Eroare la calcul:', error);
          set({ calculating: false });
        }
      },
      clearResults: () => set({ results: null }),

      // Reset
      reset: () => set({
        currentStep: 1 as WizardStep,
        fiscalYear: 2025 as FiscalYear,
        brokers: [],
        transactionsByBroker: {},
        foreignDividends: [],
        domesticDividends: [],
        otherIncome: { ...emptyOtherIncome },
        carriedLosses: [],
        userProfile: { ...emptyUserProfile },
        results: null,
        calculating: false,
      }),
    }),
    {
      name: 'calculator-impozite-storage',
      storage: {
        getItem: (name: string) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          return deserializeState(str) as { state: CalculatorState; version?: number };
        },
        setItem: (name: string, value: unknown) => {
          localStorage.setItem(name, serializeState(value));
        },
        removeItem: (name: string) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
