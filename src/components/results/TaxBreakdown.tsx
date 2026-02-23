'use client';

import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const COLORS = ['#2a7a58', '#c77d2e', '#3d6b8e', '#9a6644', '#6db896', '#d9994a'];

export function TaxBreakdown() {
  const { results } = useCalculatorStore();
  if (!results) return null;

  const chartData = [];

  for (const cg of results.capitalGains) {
    if (cg.tax > 0 || cg.totalGrossGain > 0) {
      chartData.push({
        name: cg.brokerType === 'resident' ? 'Broker RO' : 'Broker strain',
        castig: Math.round(cg.totalGrossGain),
        pierdere: Math.round(cg.totalLoss),
        impozit: Math.round(cg.tax),
      });
    }
  }

  if (results.dividends.totalTaxDue > 0) {
    chartData.push({
      name: 'Dividende',
      castig: Math.round(results.dividends.totalGrossRON),
      pierdere: 0,
      impozit: Math.round(results.dividends.totalTaxDue),
    });
  }

  if (results.totalCASS > 0) {
    chartData.push({
      name: 'CASS',
      castig: 0,
      pierdere: 0,
      impozit: Math.round(results.totalCASS),
    });
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-foreground mb-4">Detalii impozite</h3>

      {chartData.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="20%">
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toLocaleString()}`} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${Number(value).toLocaleString('ro-RO')} lei`]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e0c6b0', fontSize: '12px' }}
                />
                <Bar dataKey="impozit" name="Impozit" radius={[4, 4, 0, 0]}>
                  {chartData.map((_entry, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-broker details */}
      {results.capitalGains.map((cg, idx) => (
        <Card key={idx} className="mb-4">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={cg.brokerType === 'resident' ? 'default' : 'secondary'}>
                {cg.brokerType === 'resident' ? 'Rezident' : 'Nerezident'}
              </Badge>
              <span className="text-sm font-semibold">{cg.brokerId}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Castig brut</p>
                <p className="font-semibold text-forest-700">{Math.round(cg.totalGrossGain).toLocaleString('ro-RO')} lei</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pierderi</p>
                <p className="font-semibold text-destructive">{Math.round(cg.totalLoss).toLocaleString('ro-RO')} lei</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net</p>
                <p className="font-semibold">{Math.round(cg.netGain).toLocaleString('ro-RO')} lei</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impozabil</p>
                <p className="font-semibold">{Math.round(cg.taxableGain).toLocaleString('ro-RO')} lei</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impozit</p>
                <p className="font-bold text-primary">{Math.round(cg.tax).toLocaleString('ro-RO')} lei</p>
              </div>
            </div>
            {cg.carriedLossApplied > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Pierderi reportate aplicate: {Math.round(cg.carriedLossApplied).toLocaleString('ro-RO')} lei
              </p>
            )}
            {cg.lots.length > 0 && (
              <details className="mt-4">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                  Detalii per lot ({cg.lots.length} loturi)
                </summary>
                <div className="mt-2 max-h-60 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 font-medium">Simbol</th>
                        <th className="text-left py-1 font-medium">Cant.</th>
                        <th className="text-left py-1 font-medium">Zile</th>
                        <th className="text-right py-1 font-medium">Castig</th>
                        <th className="text-right py-1 font-medium">Impozit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cg.lots.map((lot, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1 font-medium">{lot.symbol}</td>
                          <td className="py-1">{lot.quantity.toFixed(2)}</td>
                          <td className="py-1">{lot.holdingDays}z</td>
                          <td className={`py-1 text-right ${lot.gainRON >= 0 ? 'text-forest-700' : 'text-destructive'}`}>
                            {Math.round(lot.gainRON).toLocaleString('ro-RO')}
                          </td>
                          <td className="py-1 text-right font-medium">{Math.round(lot.taxAmount).toLocaleString('ro-RO')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Dividend details */}
      {results.dividends.details.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h4 className="text-sm font-semibold mb-3">Dividende straine — credit fiscal</h4>
            <div className="space-y-2">
              {results.dividends.details.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{d.country}</Badge>
                    <span className="font-medium">{d.symbol}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Brut: {Math.round(d.grossAmountRON).toLocaleString('ro-RO')}</span>
                    <span>WHT: {Math.round(d.whtRON).toLocaleString('ro-RO')}</span>
                    <span>Credit: {Math.round(d.taxCredit).toLocaleString('ro-RO')}</span>
                    <span className="font-semibold text-foreground">Plata: {Math.round(d.taxDue).toLocaleString('ro-RO')} lei</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
