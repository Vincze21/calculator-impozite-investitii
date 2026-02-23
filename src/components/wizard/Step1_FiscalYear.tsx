'use client';

import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FiscalYear } from '@/types/tax';
import { RATES_RESIDENT, RATES_NONRESIDENT, DIVIDEND_TAX } from '@/lib/constants';

const yearDetails: Record<FiscalYear, { description: string; highlights: string[] }> = {
  2025: {
    description: 'Cote mai mici pe castiguri de capital. Ultimul an cu impozit 10% pe dividende.',
    highlights: [
      `Broker RO: ${RATES_RESIDENT[2025].long * 100}% (detinere \u2265 1 an) / ${RATES_RESIDENT[2025].short * 100}% (detinere < 1 an)`,
      `Broker strain: ${RATES_NONRESIDENT[2025] * 100}% net anual`,
      `Dividende: ${DIVIDEND_TAX[2025] * 100}%`,
      'Termen D212: 25 mai 2026',
    ],
  },
  2026: {
    description: 'Cote majorate conform Legii 239/2025 si Legii 141/2025.',
    highlights: [
      `Broker RO: ${RATES_RESIDENT[2026].long * 100}% (detinere \u2265 1 an) / ${RATES_RESIDENT[2026].short * 100}% (detinere < 1 an)`,
      `Broker strain: ${RATES_NONRESIDENT[2026] * 100}% net anual`,
      `Dividende: ${DIVIDEND_TAX[2026] * 100}%`,
      'Termen D212: 25 mai 2027',
    ],
  },
};

export function Step1FiscalYear() {
  const { fiscalYear, setFiscalYear } = useCalculatorStore();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Pentru ce an fiscal calculezi?
        </h2>
        <p className="text-muted-foreground mt-2">
          Cotele de impozit difera semnificativ intre 2025 si 2026.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
        {([2025, 2026] as FiscalYear[]).map((year) => {
          const isSelected = fiscalYear === year;
          const details = yearDetails[year];

          return (
            <Card
              key={year}
              className={`cursor-pointer transition-all duration-200 card-lift ${
                isSelected
                  ? 'ring-2 ring-primary border-primary bg-forest-50'
                  : 'hover:border-primary/40'
              }`}
              onClick={() => setFiscalYear(year)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-3xl font-bold text-foreground">{year}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {details.description}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'border-primary bg-primary' : 'border-border'
                    }`}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {details.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary' : 'bg-border'}`} />
                      <span className="text-sm text-foreground">{h}</span>
                    </div>
                  ))}
                </div>

                {isSelected && (
                  <Badge className="mt-4 bg-primary/10 text-primary border-0 hover:bg-primary/10">
                    Selectat
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-warm-100/60 border border-warm-200 rounded-lg">
        <p className="text-sm text-warm-700">
          <strong>CASS (Contributie Sanatate)</strong> se calculeaza identic in ambii ani: 10% pe plafoane fixe (24.300 / 48.600 / 97.200 lei), indiferent de anul fiscal.
        </p>
      </div>
    </div>
  );
}
