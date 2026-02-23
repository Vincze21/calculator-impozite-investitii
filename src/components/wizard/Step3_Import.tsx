'use client';

import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCalculatorStore } from '@/hooks/useCalculator';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BROKER_PRESETS, type BrokerName } from '@/types/broker';

interface ImportedFile {
  brokerId: string;
  brokerName: BrokerName;
  brokerDisplayName: string;
  brokerType: 'resident' | 'nonresident';
  fileName: string;
  txCount: number;
  divCount: number;
  warnings: string[];
}

export function Step3Import() {
  const {
    brokers, addBroker, setTransactionsForBroker,
    mergeDividendsForBroker, clearDataForBroker, goNext,
  } = useCalculatorStore();
  const { parsing, progress, error, parseFile, reset } = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [showWarnings, setShowWarnings] = useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const parsed = await parseFile(file);
    if (parsed) {
      // Find matching broker or auto-add it
      let matchingBroker = brokers.find(b => b.name === parsed.broker);
      if (!matchingBroker && parsed.broker in BROKER_PRESETS) {
        const preset = BROKER_PRESETS[parsed.broker as BrokerName];
        matchingBroker = {
          id: uuidv4(),
          name: parsed.broker as BrokerName,
          displayName: preset.displayName,
          type: preset.type,
        };
        addBroker(matchingBroker);
      }

      if (matchingBroker) {
        // Store transactions (replaces for this broker)
        setTransactionsForBroker(matchingBroker.id, parsed.transactions);

        // Merge dividends (replaces only this broker's dividends)
        if (parsed.dividends.length > 0) {
          const divType = matchingBroker.type === 'resident' ? 'domestic' : 'foreign';
          mergeDividendsForBroker(matchingBroker.id, divType, parsed.dividends);
        }

        // Track imported file (replace if same broker already imported)
        const newImport: ImportedFile = {
          brokerId: matchingBroker.id,
          brokerName: matchingBroker.name,
          brokerDisplayName: matchingBroker.displayName,
          brokerType: matchingBroker.type,
          fileName: file.name,
          txCount: parsed.transactions.length,
          divCount: parsed.dividends.length,
          warnings: parsed.warnings,
        };

        setImportedFiles(prev => {
          const filtered = prev.filter(f => f.brokerId !== matchingBroker!.id);
          return [...filtered, newImport];
        });
      }

      // Reset for next upload
      reset();
    }

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [brokers, parseFile, addBroker, setTransactionsForBroker, mergeDividendsForBroker, reset]);

  const handleRemoveImport = useCallback((brokerId: string) => {
    clearDataForBroker(brokerId);
    setImportedFiles(prev => prev.filter(f => f.brokerId !== brokerId));
  }, [clearDataForBroker]);

  const handleManual = () => {
    goNext();
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Cum vrei sa introduci datele?
        </h2>
        <p className="text-muted-foreground mt-2">
          Poti importa rapoarte CSV/PDF de la mai multi brokeri sau introduce tranzactiile manual.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Upload file */}
        <Card className="card-lift cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-forest-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-forest-200 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-forest-700">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-1">
              {importedFiles.length > 0 ? 'Adauga alt fisier' : 'Import fisier'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {importedFiles.length > 0
                ? 'Poti importa fisiere de la mai multi brokeri.'
                : 'Uploadeaza raportul de tranzactii de la broker (CSV sau PDF). Detectam automat formatul.'}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              <Badge variant="secondary" className="text-xs">Interactive Brokers</Badge>
              <Badge variant="secondary" className="text-xs">AvaTrade</Badge>
              <Badge variant="secondary" className="text-xs">TradeVille</Badge>
              <Badge variant="secondary" className="text-xs">Trading 212</Badge>
              <Badge variant="secondary" className="text-xs">Revolut</Badge>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Manual input */}
        <Card className="card-lift cursor-pointer group" onClick={handleManual}>
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-warm-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-warm-200 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-700">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
              </svg>
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-1">Input manual</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Introdu tranzactiile una cate una. Recomandat daca ai putine tranzactii.
            </p>
            <Badge variant="secondary" className="text-xs">Orice broker</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Parsing status */}
      {parsing && (
        <div className="mt-6 text-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {progress || 'Se proceseaza fisierul...'}
          </p>
        </div>
      )}

      {error && (
        <Alert className="mt-6 border-destructive/50 bg-destructive/5 text-destructive">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div className="ml-2">
            <p className="text-sm font-medium">Eroare la parsare</p>
            <p className="text-xs mt-1">{error}</p>
            <Button variant="outline" size="sm" onClick={reset} className="mt-2">
              Incearca din nou
            </Button>
          </div>
        </Alert>
      )}

      {/* Imported files list */}
      {importedFiles.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Fisiere importate ({importedFiles.length})
          </p>
          {importedFiles.map((imp) => (
            <div key={imp.brokerId} className="p-4 bg-forest-50 border border-forest-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-forest-600"><polyline points="20 6 9 17 4 12"/></svg>
                  <p className="text-sm font-semibold text-forest-800">{imp.brokerDisplayName}</p>
                  <Badge variant={imp.brokerType === 'resident' ? 'default' : 'secondary'} className="text-[10px]">
                    {imp.brokerType === 'resident' ? 'RO' : 'INT'}
                  </Badge>
                </div>
                <button
                  onClick={() => handleRemoveImport(imp.brokerId)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  title="Sterge importul"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <p className="text-xs text-forest-600 mb-2">{imp.fileName}</p>
              <div className="grid grid-cols-3 gap-4 text-sm text-forest-700">
                <div>
                  <p className="font-semibold">{imp.txCount}</p>
                  <p className="text-xs">tranzactii</p>
                </div>
                <div>
                  <p className="font-semibold">{imp.divCount}</p>
                  <p className="text-xs">dividende</p>
                </div>
                <div>
                  <p className="font-semibold">{imp.warnings.length}</p>
                  <p className="text-xs">avertismente</p>
                </div>
              </div>
              {imp.warnings.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowWarnings(showWarnings === imp.brokerId ? null : imp.brokerId)}
                    className="text-xs text-warm-600 hover:text-warm-700 underline"
                  >
                    {showWarnings === imp.brokerId ? 'Ascunde avertismente' : 'Vezi avertismente'}
                  </button>
                  {showWarnings === imp.brokerId && (
                    <div className="mt-2 pt-2 border-t border-forest-200">
                      {imp.warnings.slice(0, 10).map((w, i) => (
                        <p key={i} className="text-xs text-warm-600">{w}</p>
                      ))}
                      {imp.warnings.length > 10 && (
                        <p className="text-xs text-warm-500 mt-1">
                          + inca {imp.warnings.length - 10} avertismente
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <Button onClick={goNext} className="mt-4 w-full">
            Continua la editarea tranzactiilor
          </Button>
        </div>
      )}

      {brokers.length > 0 && brokers.every(b => b.type === 'resident') && importedFiles.length === 0 && (
        <div className="mt-6 p-4 bg-warm-100/60 border border-warm-200 rounded-lg">
          <p className="text-sm text-warm-700">
            Toti brokerii tai sunt rezidenti. Impozitul a fost deja retinut la sursa.
            Poti importa raportul TradeVille (CSV) pentru a calcula CASS si a verifica tranzactiile,
            sau continua manual.
          </p>
        </div>
      )}
    </div>
  );
}
