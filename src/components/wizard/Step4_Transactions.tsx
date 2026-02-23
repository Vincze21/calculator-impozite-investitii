'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { InstrumentType } from '@/types/transaction';

const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  stock: 'Actiuni',
  etf_acc: 'ETF Acumulare',
  etf_dist: 'ETF Distributie',
  bond_gov: 'Titluri de Stat',
  bond_corp: 'Obligatiuni Corp.',
  option: 'Optiuni',
  future: 'Futures',
  cfd: 'CFD',
  mutual_fund: 'Fond Mutual',
  crypto: 'Crypto',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'RON', 'CHF'];

export function Step4Transactions() {
  const { brokers, transactionsByBroker, addTransaction, removeTransaction } = useCalculatorStore();
  const [activeBrokerId, setActiveBrokerId] = useState(brokers[0]?.id ?? '');

  // New transaction form
  const [formData, setFormData] = useState({
    type: 'buy' as 'buy' | 'sell',
    date: '',
    symbol: '',
    quantity: '',
    pricePerUnit: '',
    commission: '0',
    currency: 'USD',
    instrumentType: 'stock' as InstrumentType,
  });

  const handleAdd = () => {
    if (!formData.date || !formData.symbol || !formData.quantity || !formData.pricePerUnit) return;

    const qty = parseFloat(formData.quantity);
    const price = parseFloat(formData.pricePerUnit);
    const comm = parseFloat(formData.commission) || 0;

    addTransaction(activeBrokerId, {
      id: uuidv4(),
      date: new Date(formData.date),
      type: formData.type,
      symbol: formData.symbol.toUpperCase(),
      quantity: qty,
      pricePerUnit: price,
      totalAmount: qty * price,
      commission: comm,
      currency: formData.currency,
      instrumentType: formData.instrumentType,
    });

    setFormData(prev => ({ ...prev, date: '', symbol: '', quantity: '', pricePerUnit: '', commission: '0' }));
  };

  if (brokers.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Adauga cel putin un broker la pasul anterior.</p>
      </div>
    );
  }

  const activeTxs = transactionsByBroker[activeBrokerId] ?? [];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Tranzactiile tale
        </h2>
        <p className="text-muted-foreground mt-2">
          Adauga cumparari si vanzari. Algoritmul FIFO va calcula automat castigul/pierderea per lot.
        </p>
      </div>

      {/* Broker tabs */}
      {brokers.length > 1 ? (
        <Tabs value={activeBrokerId} onValueChange={setActiveBrokerId} className="mb-6">
          <TabsList>
            {brokers.map(b => (
              <TabsTrigger key={b.id} value={b.id} className="gap-2">
                {b.displayName}
                <Badge variant="secondary" className="text-xs ml-1">
                  {(transactionsByBroker[b.id] ?? []).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {brokers.map(b => (
            <TabsContent key={b.id} value={b.id} />
          ))}
        </Tabs>
      ) : (
        <div className="flex items-center gap-2 mb-6">
          <Badge variant="outline">{brokers[0].displayName}</Badge>
          <span className="text-sm text-muted-foreground">
            {activeTxs.length} tranzactii
          </span>
        </div>
      )}

      {/* Add transaction form */}
      <Card className="mb-6 border-primary/20">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Adauga tranzactie</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Tip</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData(p => ({ ...p, type: v as 'buy' | 'sell' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Cumparare</SelectItem>
                  <SelectItem value="sell">Vanzare</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Simbol</Label>
              <Input placeholder="ex: AAPL" value={formData.symbol} onChange={(e) => setFormData(p => ({ ...p, symbol: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Instrument</Label>
              <Select value={formData.instrumentType} onValueChange={(v) => setFormData(p => ({ ...p, instrumentType: v as InstrumentType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INSTRUMENT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cantitate</Label>
              <Input type="number" step="0.0001" min="0" placeholder="0" value={formData.quantity} onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Pret/unitate</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.pricePerUnit} onChange={(e) => setFormData(p => ({ ...p, pricePerUnit: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Comision</Label>
              <Input type="number" step="0.01" min="0" value={formData.commission} onChange={(e) => setFormData(p => ({ ...p, commission: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Valuta</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAdd} className="mt-4 w-full sm:w-auto" disabled={!formData.date || !formData.symbol || !formData.quantity || !formData.pricePerUnit}>
            Adauga tranzactie
          </Button>
        </CardContent>
      </Card>

      {/* Transaction list */}
      {activeTxs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
          <p className="text-muted-foreground">Nicio tranzactie inca.</p>
          <p className="text-sm text-muted-foreground mt-1">Completeaza formularul de mai sus sau importa un CSV.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeTxs.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border hover:border-primary/20 transition-colors group">
              <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                tx.type === 'buy' ? 'bg-forest-100 text-forest-700' : 'bg-warm-100 text-warm-700'
              }`}>
                {tx.type === 'buy' ? 'C' : 'V'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{tx.symbol}</span>
                  <Badge variant="secondary" className="text-xs">{INSTRUMENT_LABELS[tx.instrumentType]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tx.date instanceof Date ? tx.date.toLocaleDateString('ro-RO') : new Date(tx.date).toLocaleDateString('ro-RO')} &middot; {tx.quantity} x {tx.pricePerUnit} {tx.currency}
                  {tx.commission > 0 && ` (com. ${tx.commission})`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{(tx.quantity * tx.pricePerUnit).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{tx.currency}</p>
              </div>
              <button
                onClick={() => removeTransaction(activeBrokerId, tx.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
