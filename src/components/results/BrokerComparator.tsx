'use client';

import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { BrokerComparisonResult, ComparisonInsight } from '@/types/tax';
import { RATES_RESIDENT, RATES_NONRESIDENT } from '@/lib/constants';

const COLOR_RO = '#2a7a58';
const COLOR_INTL = '#c77d2e';

type UserSituation = 'all_nonresident' | 'all_resident' | 'mixed';

function getUserSituation(brokers: { type: string }[]): UserSituation {
  const hasRes = brokers.some(b => b.type === 'resident');
  const hasNonRes = brokers.some(b => b.type === 'nonresident');
  if (hasRes && hasNonRes) return 'mixed';
  if (hasRes) return 'all_resident';
  return 'all_nonresident';
}

function getTagRO(situation: UserSituation): string | null {
  if (situation === 'all_resident') return 'situatia ta';
  if (situation === 'all_nonresident') return 'simulare';
  return null;
}

function getTagIntl(situation: UserSituation): string | null {
  if (situation === 'all_nonresident') return 'situatia ta';
  if (situation === 'all_resident') return 'simulare';
  return null;
}

export function BrokerComparator() {
  const { results, brokers } = useCalculatorStore();

  if (!results?.comparison) return null;
  const cmp = results.comparison;
  const situation = getUserSituation(brokers);

  const brokerNames = brokers.map(b => b.displayName).join(', ');

  return (
    <div>
      <h3 className="text-lg font-bold text-foreground mb-2">
        Simulare: Regim Rezident vs. Regim Nerezident
      </h3>

      {/* Contextual description */}
      <p className="text-sm text-muted-foreground mb-3">
        {situation === 'all_nonresident' && (
          <>Ai folosit brokeri straini ({brokerNames}). Mai jos vezi cum ar arata impozitele daca <strong className="text-foreground">aceleasi {cmp.transactionCount} vanzari</strong> ar fi fost executate printr-un broker RO rezident (ex: TradeVille).</>
        )}
        {situation === 'all_resident' && (
          <>Ai folosit brokeri RO ({brokerNames}). Mai jos vezi cum ar arata impozitele daca <strong className="text-foreground">aceleasi {cmp.transactionCount} vanzari</strong> ar fi fost executate printr-un broker strain nerezident (ex: Interactive Brokers).</>
        )}
        {situation === 'mixed' && (
          <>Ai mix de brokeri ({brokerNames}). Toate tranzactiile sunt combinate si simulate prin fiecare regim fiscal. Cifrele reale le gasesti mai sus in sectiunea &laquo;Detalii impozite&raquo;.</>
        )}
      </p>

      {/* Simulation banner */}
      <div className="flex items-start gap-2 p-3 mb-4 bg-warm-50 border border-warm-200 rounded-lg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-600 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p className="text-xs text-warm-800">
          <strong>Simulare ipotetica</strong> — Aceasta sectiune NU reflecta impozitele tale reale. Este o comparatie educativa care arata diferenta dintre cele doua regimuri fiscale pe aceleasi tranzactii. Impozitele tale efective sunt afisate mai sus.
        </p>
      </div>

      <SavingsCard comparison={cmp} situation={situation} />
      <SideBySideSummary comparison={cmp} situation={situation} />
      <ComparisonChart comparison={cmp} situation={situation} />
      <DifferencesTable comparison={cmp} situation={situation} />
      <InsightsList insights={cmp.insights} />
      <LotDetails comparison={cmp} situation={situation} />
    </div>
  );
}

// ── Savings Card ──

function SavingsCard({ comparison: cmp, situation }: { comparison: BrokerComparisonResult; situation: UserSituation }) {
  const isEqual = cmp.cheaperRegime === 'equal';
  const isRO = cmp.cheaperRegime === 'resident';

  const bgClass = isEqual
    ? 'bg-muted/50 border-border'
    : isRO
      ? 'bg-forest-50 border-forest-200'
      : 'bg-warm-50 border-warm-200';

  const textClass = isEqual
    ? 'text-muted-foreground'
    : isRO
      ? 'text-forest-700'
      : 'text-warm-700';

  const winnerLabel = isRO ? 'Regimul rezident (broker RO)' : 'Regimul nerezident (broker strain)';
  const winnerContext = isRO
    ? (situation === 'all_resident' ? '' : situation === 'all_nonresident' ? ' — ipotetic' : '')
    : (situation === 'all_nonresident' ? '' : situation === 'all_resident' ? ' — ipotetic' : '');

  return (
    <Card className={`mb-4 border ${bgClass}`}>
      <CardContent className="p-5 text-center">
        {isEqual ? (
          <p className="text-sm font-medium text-muted-foreground">
            Ambele regimuri au acelasi cost fiscal total.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-1">
              {winnerLabel}{winnerContext} ar fi mai avantajos cu
            </p>
            <p className={`text-3xl font-bold ${textClass}`}>
              {Math.abs(cmp.savings).toLocaleString('ro-RO')} <span className="text-base font-normal">lei</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              (Rezident: {cmp.resident.totalDue.toLocaleString('ro-RO')} lei vs Nerezident: {cmp.nonresident.totalDue.toLocaleString('ro-RO')} lei — impozit + CASS)
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Side-by-Side Summary ──

function SideBySideSummary({ comparison: cmp, situation }: { comparison: BrokerComparisonResult; situation: UserSituation }) {
  const tagRO = getTagRO(situation);
  const tagIntl = getTagIntl(situation);

  return (
    <Card className="mb-4">
      <CardContent className="p-5">
        <div className="grid grid-cols-2 gap-4">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLOR_RO }} />
            <span className="text-sm font-bold">Regim Rezident</span>
            {tagRO === 'situatia ta' && (
              <Badge variant="default" className="text-[10px]">situatia ta</Badge>
            )}
            {tagRO === 'simulare' && (
              <Badge variant="secondary" className="text-[10px] opacity-70">simulare</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLOR_INTL }} />
            <span className="text-sm font-bold">Regim Nerezident</span>
            {tagIntl === 'situatia ta' && (
              <Badge variant="default" className="text-[10px]">situatia ta</Badge>
            )}
            {tagIntl === 'simulare' && (
              <Badge variant="secondary" className="text-[10px] opacity-70">simulare</Badge>
            )}
          </div>

          {/* Rows */}
          <CompareRow
            label="Castig brut"
            left={cmp.resident.capitalGainResult.totalGrossGain}
            right={cmp.nonresident.capitalGainResult.totalGrossGain}
            highlightLower={false}
          />
          <CompareRow
            label="Pierderi"
            left={cmp.resident.capitalGainResult.totalLoss}
            right={cmp.nonresident.capitalGainResult.totalLoss}
            highlightLower={false}
            isLoss
          />
          <CompareRow
            label="Impozabil"
            left={cmp.resident.capitalGainResult.taxableGain}
            right={cmp.nonresident.capitalGainResult.taxableGain}
            highlightLower
          />
          <CompareRow
            label="Impozit capital"
            left={cmp.resident.totalCapitalGainsTax}
            right={cmp.nonresident.totalCapitalGainsTax}
            highlightLower
          />
          <CompareRow
            label="CASS"
            left={cmp.resident.totalCASS}
            right={cmp.nonresident.totalCASS}
            highlightLower
          />

          {/* Total */}
          <div className="col-span-2 border-t border-border pt-3 mt-1 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total de plata</p>
              <p className={`text-xl font-bold ${cmp.cheaperRegime === 'resident' ? 'text-forest-700' : ''}`}>
                {Math.round(cmp.resident.totalDue).toLocaleString('ro-RO')} <span className="text-xs font-normal text-muted-foreground">lei</span>
              </p>
              <p className="text-xs text-muted-foreground">Cota efectiva: {cmp.resident.effectiveTaxRate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de plata</p>
              <p className={`text-xl font-bold ${cmp.cheaperRegime === 'nonresident' ? 'text-forest-700' : ''}`}>
                {Math.round(cmp.nonresident.totalDue).toLocaleString('ro-RO')} <span className="text-xs font-normal text-muted-foreground">lei</span>
              </p>
              <p className="text-xs text-muted-foreground">Cota efectiva: {cmp.nonresident.effectiveTaxRate}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompareRow({
  label, left, right, highlightLower, isLoss,
}: {
  label: string; left: number; right: number; highlightLower: boolean; isLoss?: boolean;
}) {
  const leftWins = highlightLower && left < right;
  const rightWins = highlightLower && right < left;

  return (
    <>
      <div className="flex justify-between text-sm py-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${isLoss ? 'text-destructive' : leftWins ? 'text-forest-700 font-bold' : ''}`}>
          {Math.round(left).toLocaleString('ro-RO')} lei
        </span>
      </div>
      <div className="flex justify-between text-sm py-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${isLoss ? 'text-destructive' : rightWins ? 'text-forest-700 font-bold' : ''}`}>
          {Math.round(right).toLocaleString('ro-RO')} lei
        </span>
      </div>
    </>
  );
}

// ── Comparison Chart ──

function ComparisonChart({ comparison: cmp, situation }: { comparison: BrokerComparisonResult; situation: UserSituation }) {
  const tagRO = getTagRO(situation);
  const tagIntl = getTagIntl(situation);

  const labelRO = tagRO ? `Rezident (${tagRO})` : 'Rezident';
  const labelIntl = tagIntl ? `Nerezident (${tagIntl})` : 'Nerezident';

  const chartData = [
    {
      name: 'Impozit capital',
      [labelRO]: Math.round(cmp.resident.totalCapitalGainsTax),
      [labelIntl]: Math.round(cmp.nonresident.totalCapitalGainsTax),
    },
    {
      name: 'CASS',
      [labelRO]: Math.round(cmp.resident.totalCASS),
      [labelIntl]: Math.round(cmp.nonresident.totalCASS),
    },
    {
      name: 'Total',
      [labelRO]: Math.round(cmp.resident.totalDue),
      [labelIntl]: Math.round(cmp.nonresident.totalDue),
    },
  ];

  return (
    <Card className="mb-4">
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="25%">
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toLocaleString()}`} />
            <RechartsTooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [`${Number(value).toLocaleString('ro-RO')} lei`]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e0c6b0', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey={labelRO} fill={COLOR_RO} radius={[4, 4, 0, 0]} />
            <Bar dataKey={labelIntl} fill={COLOR_INTL} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Key Differences Table ──

function DifferencesTable({ comparison: cmp, situation }: { comparison: BrokerComparisonResult; situation: UserSituation }) {
  const rates = RATES_RESIDENT[cmp.fiscalYear];
  const rateNR = RATES_NONRESIDENT[cmp.fiscalYear];
  const tagRO = getTagRO(situation);
  const tagIntl = getTagIntl(situation);

  const headerRO = tagRO ? `Rezident (${tagRO})` : 'Rezident';
  const headerIntl = tagIntl ? `Nerezident (${tagIntl})` : 'Nerezident';

  const rows = [
    {
      aspect: 'Cota impozit',
      ro: `${(rates.long * 100).toFixed(0)}% (detinere \u2265 1 an) / ${(rates.short * 100).toFixed(0)}% (detinere < 1 an)`,
      intl: `${(rateNR * 100).toFixed(0)}% (cota unica)`,
    },
    {
      aspect: 'Baza impozabila',
      ro: 'Per tranzactie profitabila',
      intl: 'Castig net anual (gains - losses)',
    },
    {
      aspect: 'Pierderi',
      ro: 'Definitive, necompensabile',
      intl: 'Compensabile, reportare 5 ani',
    },
    {
      aspect: 'Baza CASS',
      ro: `Castig brut: ${Math.round(cmp.resident.cassResult.totalNonSalaryIncome).toLocaleString('ro-RO')} lei`,
      intl: `Castig net: ${Math.round(cmp.nonresident.cassResult.totalNonSalaryIncome).toLocaleString('ro-RO')} lei`,
    },
    {
      aspect: 'D212 pt impozit',
      ro: 'Nu (retinut la sursa)',
      intl: 'Da (obligatoriu)',
    },
  ];

  return (
    <Card className="mb-4">
      <CardContent className="p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Diferente cheie regim fiscal
        </p>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Aspect</th>
                <th className="text-left py-2 font-medium" style={{ color: COLOR_RO }}>{headerRO}</th>
                <th className="text-left py-2 font-medium" style={{ color: COLOR_INTL }}>{headerIntl}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 font-medium text-muted-foreground">{row.aspect}</td>
                  <td className="py-2">{row.ro}</td>
                  <td className="py-2">{row.intl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Insights List ──

function InsightsList({ insights }: { insights: ComparisonInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardContent className="p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Observatii si recomandari
        </p>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <InsightItem key={i} insight={insight} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InsightItem({ insight }: { insight: ComparisonInsight }) {
  const borderColor = insight.type === 'advantage'
    ? 'border-l-forest-500'
    : insight.type === 'warning'
      ? 'border-l-warm-500'
      : 'border-l-clay-300';

  const icon = insight.type === 'advantage' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-forest-500 shrink-0 mt-0.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  ) : insight.type === 'warning' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-500 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-clay-500 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
  );

  const regimeLabel = insight.regime === 'resident'
    ? 'Rezident'
    : insight.regime === 'nonresident'
      ? 'Nerezident'
      : null;

  return (
    <div className={`flex items-start gap-2 p-2.5 bg-muted/30 rounded border-l-3 ${borderColor}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground leading-relaxed">{insight.message}</p>
      </div>
      {regimeLabel && (
        <Badge variant="secondary" className="text-[10px] shrink-0">{regimeLabel}</Badge>
      )}
    </div>
  );
}

// ── Lot Details (expandable) ──

function LotDetails({ comparison: cmp, situation }: { comparison: BrokerComparisonResult; situation: UserSituation }) {
  const resLots = cmp.resident.capitalGainResult.lots;
  const nrLots = cmp.nonresident.capitalGainResult.lots;
  const tagRO = getTagRO(situation);
  const tagIntl = getTagIntl(situation);

  if (resLots.length === 0 && nrLots.length === 0) return null;

  return (
    <details className="mb-4">
      <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground py-2">
        Detalii per lot — comparatie ({resLots.length} loturi)
      </summary>
      <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold" style={{ color: COLOR_RO }}>Regim Rezident</p>
              {tagRO && <Badge variant={tagRO === 'situatia ta' ? 'default' : 'secondary'} className="text-[9px]">{tagRO}</Badge>}
            </div>
            <LotTable lots={resLots} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold" style={{ color: COLOR_INTL }}>Regim Nerezident</p>
              {tagIntl && <Badge variant={tagIntl === 'situatia ta' ? 'default' : 'secondary'} className="text-[9px]">{tagIntl}</Badge>}
            </div>
            <LotTable lots={nrLots} />
          </CardContent>
        </Card>
      </div>
    </details>
  );
}

function LotTable({ lots }: { lots: BrokerComparisonResult['resident']['capitalGainResult']['lots'] }) {
  return (
    <div className="max-h-60 overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1 font-medium">Simbol</th>
            <th className="text-left py-1 font-medium">Cant.</th>
            <th className="text-left py-1 font-medium">Zile</th>
            <th className="text-right py-1 font-medium">Cota</th>
            <th className="text-right py-1 font-medium">Castig</th>
            <th className="text-right py-1 font-medium">Impozit</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-1 font-medium">{lot.symbol}</td>
              <td className="py-1">{lot.quantity.toFixed(2)}</td>
              <td className="py-1">{lot.holdingDays}z</td>
              <td className="py-1 text-right">{(lot.taxRate * 100).toFixed(0)}%</td>
              <td className={`py-1 text-right ${lot.gainRON >= 0 ? 'text-forest-700' : 'text-destructive'}`}>
                {Math.round(lot.gainRON).toLocaleString('ro-RO')}
              </td>
              <td className="py-1 text-right font-medium">
                {Math.round(lot.taxAmount).toLocaleString('ro-RO')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
