import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TaxResult } from '@/types/tax';

export function generateDetailReportPDF(result: TaxResult): jsPDF {
  const doc = new jsPDF('l', 'mm', 'a4'); // landscape for more columns

  doc.setFontSize(14);
  doc.text(`Raport Detaliat Tranzactii — ${result.fiscalYear}`, 148, 15, { align: 'center' });

  let y = 22;

  for (const cg of result.capitalGains) {
    if (cg.lots.length === 0) continue;

    doc.setFontSize(10);
    doc.text(`Broker: ${cg.brokerId} (${cg.brokerType === 'resident' ? 'Rezident' : 'Nerezident'})`, 14, y);
    y += 4;

    const rows = cg.lots.map(lot => [
      lot.symbol,
      lot.buyDate.toISOString().split('T')[0],
      lot.sellDate.toISOString().split('T')[0],
      lot.quantity.toFixed(4),
      lot.buyPrice.toFixed(2),
      lot.sellPrice.toFixed(2),
      lot.currency,
      lot.holdingDays.toString(),
      Math.round(lot.gainRON).toLocaleString('ro-RO'),
      `${(lot.taxRate * 100).toFixed(0)}%`,
      Math.round(lot.taxAmount).toLocaleString('ro-RO'),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Simbol', 'Data cumparare', 'Data vanzare', 'Cant.', 'Pret cumparare', 'Pret vanzare', 'Valuta', 'Zile', 'Castig (RON)', 'Cota', 'Impozit (RON)']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 6 },
      headStyles: { fillColor: [52, 73, 94] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4;

    // Summary row
    doc.setFontSize(8);
    doc.text(
      `Total: Castig brut = ${Math.round(cg.totalGrossGain).toLocaleString('ro-RO')} | Pierderi = ${Math.round(cg.totalLoss).toLocaleString('ro-RO')} | Net = ${Math.round(cg.netGain).toLocaleString('ro-RO')} | Impozit = ${Math.round(cg.tax).toLocaleString('ro-RO')} lei`,
      14, y
    );
    y += 8;

    if (y > 180) { doc.addPage(); y = 15; }
  }

  // Dividends
  if (result.dividends.details.length > 0) {
    if (y > 160) { doc.addPage(); y = 15; }
    doc.setFontSize(10);
    doc.text('Dividende Straine', 14, y);
    y += 4;

    const divRows = result.dividends.details.map(d => [
      d.symbol,
      d.country,
      Math.round(d.grossAmountRON).toLocaleString('ro-RO'),
      Math.round(d.whtRON).toLocaleString('ro-RO'),
      Math.round(d.taxCredit).toLocaleString('ro-RO'),
      Math.round(d.taxDue).toLocaleString('ro-RO'),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Simbol', 'Tara', 'Brut (RON)', 'WHT (RON)', 'Credit fiscal', 'De plata (RON)']],
      body: divRows,
      theme: 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [39, 174, 96] },
    });
  }

  return doc;
}

export function downloadDetailReportPDF(result: TaxResult): void {
  const doc = generateDetailReportPDF(result);
  doc.save(`CALCUL_DETALIAT_${result.fiscalYear}.pdf`);
}
