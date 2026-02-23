'use client';

import { useCalculatorStore } from '@/hooks/useCalculator';
import { TaxBreakdown } from '@/components/results/TaxBreakdown';
import { CASSBreakdown } from '@/components/results/CASSBreakdown';
import { D212Preview } from '@/components/results/D212Preview';
import { SPVGuide } from '@/components/results/SPVGuide';
import { ExportButtons } from '@/components/results/ExportButtons';
import { BrokerComparator } from '@/components/results/BrokerComparator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function ResultsPage() {
  const { results, fiscalYear } = useCalculatorStore();

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Niciun calcul efectuat inca.</p>
          <Link href="/calculator">
            <Button>Inapoi la calculator</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grain-overlay" />
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/calculator" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span className="text-sm font-medium">Modifica datele</span>
          </Link>
          <Badge variant="secondary">An fiscal {fiscalYear}</Badge>
        </div>

        {/* Hero total */}
        <div className="mb-10 animate-fade-up">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-2">
            Rezultatele tale
          </h1>

          <div className="mt-6 p-6 bg-card border border-border rounded-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Impozit castiguri capital</p>
                <p className="text-2xl font-bold text-foreground">{Math.round(results.totalCapitalGainsTax).toLocaleString('ro-RO')} <span className="text-sm font-normal text-muted-foreground">lei</span></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Impozit dividende</p>
                <p className="text-2xl font-bold text-foreground">{Math.round(results.totalDividendTax).toLocaleString('ro-RO')} <span className="text-sm font-normal text-muted-foreground">lei</span></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">CASS</p>
                <p className="text-2xl font-bold text-foreground">{Math.round(results.totalCASS).toLocaleString('ro-RO')} <span className="text-sm font-normal text-muted-foreground">lei</span></p>
              </div>
              <div className="sm:border-l sm:border-border sm:pl-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total de plata</p>
                <p className="text-3xl font-bold text-primary">{Math.round(results.totalDue).toLocaleString('ro-RO')} <span className="text-sm font-normal text-muted-foreground">lei</span></p>
              </div>
            </div>

            {results.d212Required && (
              <div className="mt-4 pt-4 border-t border-border flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-500 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div>
                  <p className="text-sm font-semibold text-foreground">D212 obligatorie</p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {results.d212Reason.map((r, i) => (
                      <li key={i}>&bull; {r}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-primary font-medium mt-1">Termen: {results.deadline.filing}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Export buttons */}
        <ExportButtons />

        {/* Detailed breakdowns */}
        <div className="space-y-8 mt-10">
          <TaxBreakdown />
          <CASSBreakdown />
          <BrokerComparator />
          {results.d212Required && <D212Preview />}
          {results.d212Required && <SPVGuide />}
        </div>

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-muted/50 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            Acest calcul are caracter informativ si NU constituie consultanta fiscala sau juridica.
            Verifica intotdeauna cu un consultant fiscal autorizat inainte de depunerea D212.
          </p>
        </div>
      </div>
    </div>
  );
}
