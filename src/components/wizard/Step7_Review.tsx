'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCalculatorStore } from '@/hooks/useCalculator';
import { useBNRRates } from '@/hooks/useBNRRates';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Step7Review() {
  const router = useRouter();
  const store = useCalculatorStore();
  const { fetchRatesForDates, fetchAnnualAvg, loading: ratesLoading } = useBNRRates();
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    fiscalYear, brokers, transactionsByBroker,
    foreignDividends, domesticDividends, otherIncome,
    userProfile, setUserProfile, calculate,
  } = store;

  const totalTxs = Object.values(transactionsByBroker).reduce((sum, txs) => sum + txs.length, 0);

  const handleCalculate = async () => {
    setCalculating(true);
    setError(null);

    try {
      // Collect all dates and currencies from transactions
      const dates: string[] = [];
      const currencies = new Set<string>();

      for (const txs of Object.values(transactionsByBroker)) {
        for (const tx of txs) {
          const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
          dates.push(d.toISOString().split('T')[0]);
          if (tx.currency !== 'RON') currencies.add(tx.currency);
        }
      }

      for (const d of foreignDividends) {
        if (d.currency !== 'RON') currencies.add(d.currency);
      }

      // Fetch BNR rates
      const exchangeRates = await fetchRatesForDates(dates, Array.from(currencies));
      const annualAvgRates = await fetchAnnualAvg(fiscalYear);

      // Calculate
      calculate(exchangeRates, annualAvgRates);

      // Navigate to results
      router.push('/calculator/results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la calcul');
      setCalculating(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Verifica datele
        </h2>
        <p className="text-muted-foreground mt-2">
          Inainte de calcul, verifica sumarul si completeaza datele de identificare (optional, pentru PDF D212).
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 stagger-children">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{fiscalYear}</p>
            <p className="text-xs text-muted-foreground mt-1">An fiscal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{brokers.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Brokeri</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{totalTxs}</p>
            <p className="text-xs text-muted-foreground mt-1">Tranzactii</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{foreignDividends.length + domesticDividends.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Dividende</p>
          </CardContent>
        </Card>
      </div>

      {/* Broker details */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Brokeri</h3>
        <div className="space-y-2">
          {brokers.map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <Badge variant={b.type === 'resident' ? 'default' : 'secondary'}>
                  {b.type === 'resident' ? 'RO' : 'INT'}
                </Badge>
                <span className="font-medium text-sm">{b.displayName}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {(transactionsByBroker[b.id] ?? []).length} tranzactii
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Other income summary */}
      {(otherIncome.cryptoGains + otherIncome.interestIncome + otherIncome.rentalIncome + otherIncome.otherIncome + otherIncome.govBondIncome) > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Alte venituri</h3>
          <div className="grid grid-cols-2 gap-2">
            {otherIncome.cryptoGains > 0 && (
              <div className="p-3 bg-card rounded-lg border border-border text-sm">
                <span className="text-muted-foreground">Crypto:</span> <strong>{otherIncome.cryptoGains.toLocaleString('ro-RO')} lei</strong>
              </div>
            )}
            {otherIncome.interestIncome > 0 && (
              <div className="p-3 bg-card rounded-lg border border-border text-sm">
                <span className="text-muted-foreground">Dobanzi:</span> <strong>{otherIncome.interestIncome.toLocaleString('ro-RO')} lei</strong>
              </div>
            )}
            {otherIncome.rentalIncome > 0 && (
              <div className="p-3 bg-card rounded-lg border border-border text-sm">
                <span className="text-muted-foreground">Chirii:</span> <strong>{otherIncome.rentalIncome.toLocaleString('ro-RO')} lei</strong>
              </div>
            )}
            {otherIncome.govBondIncome > 0 && (
              <div className="p-3 bg-forest-50 rounded-lg border border-forest-200 text-sm">
                <span className="text-forest-600">Titluri de stat:</span> <strong className="text-forest-700">{otherIncome.govBondIncome.toLocaleString('ro-RO')} lei</strong>
                <span className="text-xs text-forest-500 ml-1">(scutit)</span>
              </div>
            )}
          </div>
        </div>
      )}

      <Separator className="my-6" />

      {/* User profile (optional) */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Date de identificare</h3>
        <p className="text-xs text-muted-foreground mb-4">Optional — necesare doar pentru generarea PDF-ului D212.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Nume</Label>
            <Input value={userProfile.nume} onChange={(e) => setUserProfile({ nume: e.target.value })} placeholder="Popescu" />
          </div>
          <div>
            <Label className="text-xs">Prenume</Label>
            <Input value={userProfile.prenume} onChange={(e) => setUserProfile({ prenume: e.target.value })} placeholder="Ion" />
          </div>
          <div>
            <Label className="text-xs">Judet</Label>
            <Input value={userProfile.judet} onChange={(e) => setUserProfile({ judet: e.target.value })} placeholder="Bucuresti" />
          </div>
          <div>
            <Label className="text-xs">Localitate</Label>
            <Input value={userProfile.localitate} onChange={(e) => setUserProfile({ localitate: e.target.value })} placeholder="Sector 1" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={userProfile.email} onChange={(e) => setUserProfile({ email: e.target.value })} placeholder="ion@email.com" />
          </div>
        </div>
      </div>

      {/* Calculate button */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        onClick={handleCalculate}
        disabled={calculating || ratesLoading || brokers.length === 0}
        className="w-full h-14 text-lg font-semibold gap-3"
        size="lg"
      >
        {calculating || ratesLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            Se calculeaza...
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
            Calculeaza impozitele
          </>
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground mt-3">
        Cursurile BNR se obtin automat. Calculul dureaza cateva secunde.
      </p>
    </div>
  );
}
