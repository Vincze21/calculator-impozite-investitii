'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BROKER_PRESETS, type BrokerName } from '@/types/broker';

export function Step2Brokers() {
  const { brokers, addBroker, removeBroker } = useCalculatorStore();
  const [selectedBroker, setSelectedBroker] = useState<BrokerName | ''>('');

  const handleAdd = () => {
    if (!selectedBroker) return;
    const preset = BROKER_PRESETS[selectedBroker];
    addBroker({
      id: uuidv4(),
      name: selectedBroker,
      displayName: preset.displayName,
      type: preset.type,
    });
    setSelectedBroker('');
  };

  const usedBrokers = new Set(brokers.map(b => b.name));

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Ce brokeri ai folosit?
        </h2>
        <p className="text-muted-foreground mt-2">
          Adauga toti brokerii prin care ai tranzactionat in anul selectat. Tipul (rezident/nerezident) se detecteaza automat.
        </p>
      </div>

      {/* Add broker */}
      <div className="flex gap-3 mb-6">
        <Select value={selectedBroker} onValueChange={(v) => setSelectedBroker(v as BrokerName)}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecteaza un broker..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BROKER_PRESETS)
              .filter(([key]) => !usedBrokers.has(key as BrokerName))
              .map(([key, preset]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {preset.displayName}
                    <span className="text-xs text-muted-foreground">
                      ({preset.type === 'resident' ? 'RO' : 'strain'})
                    </span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} disabled={!selectedBroker}>
          Adauga
        </Button>
      </div>

      {/* Broker list */}
      {brokers.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3 opacity-30">+</div>
          <p className="text-muted-foreground">
            Niciun broker adaugat inca.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Selecteaza un broker din lista de mai sus.
          </p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {brokers.map((broker) => (
            <Card key={broker.id} className="card-lift">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    broker.type === 'resident'
                      ? 'bg-forest-100 text-forest-700'
                      : 'bg-warm-100 text-warm-700'
                  }`}>
                    {broker.type === 'resident' ? 'RO' : 'INT'}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{broker.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {broker.type === 'resident'
                        ? 'Broker rezident — impozit retinut la sursa'
                        : 'Broker nerezident — auto-impunere D212'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={broker.type === 'resident' ? 'default' : 'secondary'}>
                    {broker.type === 'resident' ? 'Rezident' : 'Nerezident'}
                  </Badge>
                  <button
                    onClick={() => removeBroker(broker.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
        <div className="p-4 bg-forest-50 border border-forest-200 rounded-lg">
          <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1">Broker Rezident</p>
          <p className="text-sm text-forest-800">
            Impozit retinut automat per tranzactie. Pierderile sunt definitive (necompensabile).
          </p>
        </div>
        <div className="p-4 bg-warm-100/60 border border-warm-200 rounded-lg">
          <p className="text-xs font-semibold text-warm-700 uppercase tracking-wider mb-1">Broker Nerezident</p>
          <p className="text-sm text-warm-800">
            Auto-impunere prin D212. Pierderile se pot compensa cu castigurile viitoare (max 70%, 5 ani).
          </p>
        </div>
      </div>
    </div>
  );
}
