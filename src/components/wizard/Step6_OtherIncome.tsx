'use client';

import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const INCOME_FIELDS = [
  {
    key: 'cryptoGains' as const,
    label: 'Castiguri criptomonede',
    description: 'Castigurile nete din tranzactionarea de criptomonede (in RON). Sub 200 lei/tranzactie si 600 lei/an = scutit.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    ),
  },
  {
    key: 'interestIncome' as const,
    label: 'Dobanzi',
    description: 'Dobanzi din depozite, obligatiuni corporative, sau alte surse (in RON). NU include titluri de stat.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    ),
  },
  {
    key: 'rentalIncome' as const,
    label: 'Venituri din chirii',
    description: 'Venitul net din inchirierea de proprietati (in RON).',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    ),
  },
  {
    key: 'otherIncome' as const,
    label: 'Alte venituri extrasalariale',
    description: 'Drepturi de autor, agricultura, sau alte venituri non-salariale (in RON).',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
    ),
  },
  {
    key: 'govBondIncome' as const,
    label: 'Titluri de stat (Fidelis, Tezaur)',
    description: 'Dobanzi si castiguri din titluri de stat. COMPLET SCUTITE de impozit si CASS — le completezi doar informativ.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    ),
    exempt: true,
  },
];

export function Step6OtherIncome() {
  const { otherIncome, setOtherIncome } = useCalculatorStore();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Alte venituri
        </h2>
        <p className="text-muted-foreground mt-2">
          Toate veniturile non-salariale se cumuleaza pentru calculul CASS. Completeaza doar ce ai — lasa 0 restul.
        </p>
      </div>

      <div className="space-y-4 stagger-children">
        {INCOME_FIELDS.map(({ key, label, description, icon, exempt }) => (
          <Card key={key} className={exempt ? 'border-forest-200 bg-forest-50/30' : ''}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 ${exempt ? 'text-forest-600' : 'text-muted-foreground'}`}>
                  {icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Label className="text-sm font-semibold">{label}</Label>
                    {exempt && (
                      <span className="text-xs font-medium text-forest-600 bg-forest-100 px-2 py-0.5 rounded-full">
                        SCUTIT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{description}</p>
                  <div className="flex items-center gap-2 max-w-xs">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={otherIncome[key] || ''}
                      onChange={(e) => setOtherIncome({ [key]: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">RON</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      {(otherIncome.cryptoGains + otherIncome.interestIncome + otherIncome.rentalIncome + otherIncome.otherIncome) > 0 && (
        <div className="mt-6 p-4 bg-warm-100/60 border border-warm-200 rounded-lg">
          <p className="text-sm font-semibold text-warm-800 mb-1">Total venituri suplimentare pentru CASS:</p>
          <p className="text-2xl font-bold text-warm-900">
            {(otherIncome.cryptoGains + otherIncome.interestIncome + otherIncome.rentalIncome + otherIncome.otherIncome).toLocaleString('ro-RO')} lei
          </p>
          {otherIncome.govBondIncome > 0 && (
            <p className="text-xs text-forest-600 mt-1">
              + {otherIncome.govBondIncome.toLocaleString('ro-RO')} lei titluri de stat (excluse din CASS)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
