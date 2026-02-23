'use client';

import { useCalculatorStore } from '@/hooks/useCalculator';
import { Button } from '@/components/ui/button';
import { downloadD212PDF } from '@/lib/pdf/d212-pdf';
import { downloadSPVGuidePDF } from '@/lib/pdf/spv-guide';
import { downloadDetailReportPDF } from '@/lib/pdf/detail-report';

export function ExportButtons() {
  const { results, userProfile, otherIncome } = useCalculatorStore();
  if (!results) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {results.d212Required && (
        <Button
          variant="outline"
          onClick={() => downloadD212PDF(results, userProfile, otherIncome)}
          className="gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          PDF D212 Sumar
        </Button>
      )}
      {results.d212Required && (
        <Button
          variant="outline"
          onClick={() => downloadSPVGuidePDF(results)}
          className="gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Ghid SPV
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => downloadDetailReportPDF(results)}
        className="gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Raport detaliat
      </Button>
    </div>
  );
}
