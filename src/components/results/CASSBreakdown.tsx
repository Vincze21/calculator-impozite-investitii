'use client';

import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { getCassThresholds } from '@/lib/constants';

export function CASSBreakdown() {
  const { results } = useCalculatorStore();
  if (!results) return null;

  const { cass } = results;
  const thresholds = getCassThresholds(results.fiscalYear);

  const tiers = [
    { label: 'Sub 6x SMB', max: thresholds[0], cassAmount: 0 },
    { label: '6-12x SMB', max: thresholds[1], cassAmount: thresholds[0] * 0.10 },
    { label: '12-24x SMB', max: thresholds[2], cassAmount: thresholds[1] * 0.10 },
    { label: 'Peste 24x SMB', max: Infinity, cassAmount: thresholds[2] * 0.10 },
  ];

  // Find current tier
  const currentTierIdx = cass.totalNonSalaryIncome < thresholds[0] ? 0
    : cass.totalNonSalaryIncome < thresholds[1] ? 1
    : cass.totalNonSalaryIncome < thresholds[2] ? 2
    : 3;

  // Calculate progress within the visual bar (max at 97200)
  const maxVisual = thresholds[2] * 1.1;
  const progressPercent = Math.min((cass.totalNonSalaryIncome / maxVisual) * 100, 100);

  return (
    <div>
      <h3 className="text-lg font-bold text-foreground mb-4">CASS (Contributie Sanatate)</h3>

      <Card>
        <CardContent className="p-6">
          {/* Visual bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>0 lei</span>
              <span>{thresholds[0].toLocaleString('ro-RO')}</span>
              <span>{thresholds[1].toLocaleString('ro-RO')}</span>
              <span>{thresholds[2].toLocaleString('ro-RO')}</span>
            </div>
            <div className="relative h-6 bg-muted rounded-full overflow-hidden">
              {/* Tier markers */}
              <div className="absolute top-0 bottom-0 border-r border-border" style={{ left: `${(thresholds[0] / maxVisual) * 100}%` }} />
              <div className="absolute top-0 bottom-0 border-r border-border" style={{ left: `${(thresholds[1] / maxVisual) * 100}%` }} />
              <div className="absolute top-0 bottom-0 border-r border-border" style={{ left: `${(thresholds[2] / maxVisual) * 100}%` }} />

              {/* Progress */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-primary/80 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />

              {/* Current position indicator */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-md transition-all duration-1000 ease-out"
                style={{ left: `calc(${progressPercent}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-2">
              <span className={currentTierIdx === 0 ? 'font-bold text-primary' : 'text-muted-foreground'}>0 lei</span>
              <span className={currentTierIdx === 1 ? 'font-bold text-primary' : 'text-muted-foreground'}>2.430 lei</span>
              <span className={currentTierIdx === 2 ? 'font-bold text-primary' : 'text-muted-foreground'}>4.860 lei</span>
              <span className={currentTierIdx === 3 ? 'font-bold text-primary' : 'text-muted-foreground'}>9.720 lei</span>
            </div>
          </div>

          {/* Tiers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {tiers.map((tier, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg text-center text-sm transition-all ${
                  idx === currentTierIdx
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                    : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                <p className="text-xs font-medium">{tier.label}</p>
                <p className="font-bold mt-1">{tier.cassAmount.toLocaleString('ro-RO')} lei</p>
              </div>
            ))}
          </div>

          {/* Income breakdown */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Desfasurare venituri CASS</p>
            <div className="space-y-1.5">
              {cass.breakdown.capitalGainsResident > 0 && (
                <BreakdownRow label="Castiguri capital broker RO (brut)" value={cass.breakdown.capitalGainsResident} />
              )}
              {cass.breakdown.capitalGainsNonResident > 0 && (
                <BreakdownRow label="Castiguri capital broker strain (net)" value={cass.breakdown.capitalGainsNonResident} />
              )}
              {cass.breakdown.dividendsNet > 0 && (
                <BreakdownRow label="Dividende nete" value={cass.breakdown.dividendsNet} />
              )}
              {cass.breakdown.interestNet > 0 && (
                <BreakdownRow label="Dobanzi" value={cass.breakdown.interestNet} />
              )}
              {cass.breakdown.cryptoGains > 0 && (
                <BreakdownRow label="Crypto" value={cass.breakdown.cryptoGains} />
              )}
              {cass.breakdown.rentalIncome > 0 && (
                <BreakdownRow label="Chirii" value={cass.breakdown.rentalIncome} />
              )}
              {cass.breakdown.otherIncome > 0 && (
                <BreakdownRow label="Alte venituri" value={cass.breakdown.otherIncome} />
              )}
              {cass.breakdown.govBondExcluded > 0 && (
                <div className="flex justify-between text-sm py-1 text-forest-600">
                  <span>Titluri de stat (excluse)</span>
                  <span className="line-through">{Math.round(cass.breakdown.govBondExcluded).toLocaleString('ro-RO')} lei</span>
                </div>
              )}
              <div className="flex justify-between text-sm py-2 border-t border-border font-bold">
                <span>Total venituri CASS</span>
                <span>{Math.round(cass.totalNonSalaryIncome).toLocaleString('ro-RO')} lei</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-t border-border">
                <span className="font-bold text-primary">CASS datorata</span>
                <span className="font-bold text-primary text-lg">{Math.round(cass.amount).toLocaleString('ro-RO')} lei</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{Math.round(value).toLocaleString('ro-RO')} lei</span>
    </div>
  );
}
