'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { COUNTRY_NAMES } from '@/lib/constants';

const COUNTRIES = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));
const CURRENCIES = ['USD', 'EUR', 'GBP', 'RON', 'CHF'];

export function Step5Dividends() {
  const {
    foreignDividends, domesticDividends,
    addForeignDividend, removeForeignDividend,
    addDomesticDividend, removeDomesticDividend,
  } = useCalculatorStore();

  const [tab, setTab] = useState('foreign');

  const [foreignForm, setForeignForm] = useState({
    date: '', symbol: '', grossAmount: '', whtAmount: '', currency: 'USD', country: 'US',
  });

  const [domesticForm, setDomesticForm] = useState({
    date: '', symbol: '', grossAmount: '', currency: 'RON',
  });

  const handleAddForeign = () => {
    if (!foreignForm.date || !foreignForm.symbol || !foreignForm.grossAmount) return;
    const gross = parseFloat(foreignForm.grossAmount);
    const wht = parseFloat(foreignForm.whtAmount) || 0;
    addForeignDividend({
      id: uuidv4(),
      date: new Date(foreignForm.date),
      symbol: foreignForm.symbol.toUpperCase(),
      grossAmount: gross,
      whtAmount: wht,
      netAmount: gross - wht,
      currency: foreignForm.currency,
      country: foreignForm.country,
    });
    setForeignForm(p => ({ ...p, date: '', symbol: '', grossAmount: '', whtAmount: '' }));
  };

  const handleAddDomestic = () => {
    if (!domesticForm.date || !domesticForm.symbol || !domesticForm.grossAmount) return;
    const gross = parseFloat(domesticForm.grossAmount);
    addDomesticDividend({
      id: uuidv4(),
      date: new Date(domesticForm.date),
      symbol: domesticForm.symbol.toUpperCase(),
      grossAmount: gross,
      whtAmount: 0,
      netAmount: gross,
      currency: domesticForm.currency,
      country: 'RO',
    });
    setDomesticForm(p => ({ ...p, date: '', symbol: '', grossAmount: '' }));
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Dividende primite
        </h2>
        <p className="text-muted-foreground mt-2">
          Dividendele straine necesita D212 si beneficiaza de credit fiscal. Cele romanesti sunt retinute la sursa.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="foreign" className="gap-2">
            Dividende straine
            {foreignDividends.length > 0 && <Badge variant="secondary" className="text-xs">{foreignDividends.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="domestic" className="gap-2">
            Dividende RO
            {domesticDividends.length > 0 && <Badge variant="secondary" className="text-xs">{domesticDividends.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="foreign">
          <Card className="mb-6 border-primary/20">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Adauga dividend strain</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Data platii</Label>
                  <Input type="date" value={foreignForm.date} onChange={(e) => setForeignForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Simbol</Label>
                  <Input placeholder="ex: AAPL" value={foreignForm.symbol} onChange={(e) => setForeignForm(p => ({ ...p, symbol: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Tara sursa</Label>
                  <Select value={foreignForm.country} onValueChange={(v) => setForeignForm(p => ({ ...p, country: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Suma bruta</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={foreignForm.grossAmount} onChange={(e) => setForeignForm(p => ({ ...p, grossAmount: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">WHT retinut</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={foreignForm.whtAmount} onChange={(e) => setForeignForm(p => ({ ...p, whtAmount: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Valuta</Label>
                  <Select value={foreignForm.currency} onValueChange={(v) => setForeignForm(p => ({ ...p, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddForeign} className="mt-4" disabled={!foreignForm.date || !foreignForm.symbol || !foreignForm.grossAmount}>
                Adauga dividend
              </Button>
            </CardContent>
          </Card>

          {foreignDividends.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
              <p className="text-muted-foreground">Niciun dividend strain adaugat.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {foreignDividends.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border group">
                  <Badge variant="secondary">{d.country}</Badge>
                  <div className="flex-1">
                    <span className="font-semibold text-sm">{d.symbol}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {d.date instanceof Date ? d.date.toLocaleDateString('ro-RO') : new Date(d.date).toLocaleDateString('ro-RO')}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{d.grossAmount.toFixed(2)} {d.currency}</p>
                    {d.whtAmount > 0 && <p className="text-xs text-muted-foreground">WHT: {d.whtAmount.toFixed(2)}</p>}
                  </div>
                  <button onClick={() => removeForeignDividend(d.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 bg-warm-100/60 border border-warm-200 rounded-lg">
            <p className="text-sm text-warm-700">
              <strong>Credit fiscal:</strong> impozitul retinut in strainatate (WHT) se scade din impozitul datorat in Romania. Daca WHT e mai mare decat impozitul RO, diferenta NU se restituie de ANAF.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="domestic">
          <Card className="mb-6 border-primary/20">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Adauga dividend romanesc</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={domesticForm.date} onChange={(e) => setDomesticForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Simbol</Label>
                  <Input placeholder="ex: SNN" value={domesticForm.symbol} onChange={(e) => setDomesticForm(p => ({ ...p, symbol: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Suma neta primita</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={domesticForm.grossAmount} onChange={(e) => setDomesticForm(p => ({ ...p, grossAmount: e.target.value }))} />
                </div>
              </div>
              <Button onClick={handleAddDomestic} className="mt-4" disabled={!domesticForm.date || !domesticForm.symbol || !domesticForm.grossAmount}>
                Adauga dividend
              </Button>
            </CardContent>
          </Card>

          {domesticDividends.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
              <p className="text-muted-foreground">Niciun dividend romanesc adaugat.</p>
              <p className="text-xs text-muted-foreground mt-1">Dividendele RO sunt retinute la sursa — le adaugi doar pentru calculul CASS.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {domesticDividends.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border group">
                  <Badge>RO</Badge>
                  <div className="flex-1">
                    <span className="font-semibold text-sm">{d.symbol}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {d.date instanceof Date ? d.date.toLocaleDateString('ro-RO') : new Date(d.date).toLocaleDateString('ro-RO')}
                    </span>
                  </div>
                  <div className="text-right text-sm font-semibold">{d.grossAmount.toFixed(2)} RON</div>
                  <button onClick={() => removeDomesticDividend(d.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
