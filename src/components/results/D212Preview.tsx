'use client';

import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { COUNTRY_NAMES, RATES_NONRESIDENT, DIVIDEND_TAX } from '@/lib/constants';

export function D212Preview() {
  const { results } = useCalculatorStore();
  if (!results || !results.d212Required) return null;

  const nonResidentGains = results.capitalGains.filter(cg => cg.brokerType === 'nonresident');
  const hasCapitalGains = nonResidentGains.length > 0 && nonResidentGains.some(cg => cg.totalGrossGain > 0 || cg.totalLoss > 0);
  const hasDividends = results.dividends.details.length > 0;
  const hasCASS = results.cass.amount > 0;

  // Group dividends by country
  const divByCountry = new Map<string, { gross: number; tax: number; wht: number; credit: number; due: number }>();
  for (const d of results.dividends.details) {
    const existing = divByCountry.get(d.country) ?? { gross: 0, tax: 0, wht: 0, credit: 0, due: 0 };
    existing.gross += d.grossAmountRON;
    existing.tax += d.taxRO;
    existing.wht += d.whtRON;
    existing.credit += d.taxCredit;
    existing.due += d.taxDue;
    divByCountry.set(d.country, existing);
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-foreground mb-4">Preview D212</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Mai jos sunt valorile pe care le vei completa in declaratie, organizate pe sectiunile oficiale D212.
      </p>

      <div className="space-y-4 stagger-children">
        {/* Sectiuni bifate */}
        <Card>
          <CardContent className="p-5">
            <h4 className="text-sm font-semibold mb-3">Sectiuni de bifat</h4>
            <div className="space-y-1.5">
              {hasCapitalGains && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">S1</Badge>
                  <span>Sectiunea 1, Subsectiunea 1 — Cat. 1.5 (Transfer titluri de valoare)</span>
                </div>
              )}
              {hasDividends && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">S2</Badge>
                  <span>Sectiunea 2, Subsectiunea 1 — Venituri din strainatate</span>
                </div>
              )}
              {hasCASS && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">S3</Badge>
                  <span>Sectiunea 3, Subsectiunea 2 — CASS</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="text-xs">S7</Badge>
                <span>Sectiunea 7 — Sumar obligatii</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sectiunea 1 */}
        {hasCapitalGains && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-chart-1/10 text-chart-1 border-0 hover:bg-chart-1/10">Sectiunea 1</Badge>
                <span className="text-sm font-semibold">Castiguri de capital (broker nerezident)</span>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm font-mono">
                {nonResidentGains.map((cg, idx) => {
                  const totalDeductible = cg.lots.reduce((s, l) =>
                    s + (l.buyPrice * l.quantity + l.buyCommission + l.sellCommission) * l.exchangeRateBuy, 0);
                  return (
                    <div key={idx}>
                      <Row label="Rd.1 Venit brut" value={Math.round(cg.totalGrossGain + cg.totalLoss)} />
                      <Row label="Rd.2 Cheltuieli deductibile" value={Math.round(totalDeductible)} />
                      <Row label="Rd.3 Castig net anual" value={Math.round(Math.max(0, cg.netGain))} />
                      <Row label="Rd.4 Pierdere fiscala" value={Math.round(cg.netGain < 0 ? Math.abs(cg.netGain) : 0)} />
                      <Row label="Rd.5 Pierderi reportate" value={Math.round(cg.carriedLossApplied)} />
                      <Row label="Rd.7 Castig impozabil" value={Math.round(cg.taxableGain)} highlight />
                      <Row label={`Rd.9 Impozit (${(RATES_NONRESIDENT[results.fiscalYear] * 100).toFixed(0)}%)`} value={Math.round(cg.tax)} highlight />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sectiunea 2 */}
        {hasDividends && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-chart-2/10 text-chart-2 border-0 hover:bg-chart-2/10">Sectiunea 2</Badge>
                <span className="text-sm font-semibold">Dividende din strainatate</span>
              </div>
              {Array.from(divByCountry).map(([country, data]) => (
                <div key={country} className="mb-4 last:mb-0">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {COUNTRY_NAMES[country] ?? country} ({country})
                  </p>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm font-mono">
                    <Row label="Rd.1 Venit brut" value={Math.round(data.gross)} />
                    <Row label="Rd.3 Venit net" value={Math.round(data.gross)} />
                    <Row label={`Rd.9 Impozit RO (${(DIVIDEND_TAX[results.fiscalYear] * 100).toFixed(0)}%)`} value={Math.round(data.tax)} />
                    <Row label="WHT platit in strainatate" value={Math.round(data.wht)} />
                    <Row label="Credit fiscal" value={Math.round(data.credit)} />
                    <Row label="Diferenta de plata" value={Math.round(data.due)} highlight />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Sectiunea 3 */}
        {hasCASS && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-chart-4/10 text-chart-4 border-0 hover:bg-chart-4/10">Sectiunea 3</Badge>
                <span className="text-sm font-semibold">CASS</span>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm font-mono">
                <Row label="Baza de calcul (plafon)" value={results.cass.base} />
                <Row label="CASS datorata (10%)" value={results.cass.amount} highlight />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sectiunea 7 */}
        <Card className="border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-primary/10 text-primary border-0 hover:bg-primary/10">Sectiunea 7</Badge>
              <span className="text-sm font-semibold">Sumar obligatii</span>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm font-mono">
              <Row label="Total impozit pe venit" value={Math.round(results.totalCapitalGainsTax + results.totalDividendTax)} />
              <Row label="Total CASS" value={Math.round(results.totalCASS)} />
              <div className="border-t border-border pt-2 mt-2">
                <Row label="TOTAL DE PLATA" value={Math.round(results.totalDue)} highlight />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Termen de plata</span>
                <span className="font-semibold text-primary">{results.deadline.payment}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={highlight ? 'font-bold text-primary' : 'font-medium'}>{value.toLocaleString('ro-RO')} lei</span>
    </div>
  );
}
