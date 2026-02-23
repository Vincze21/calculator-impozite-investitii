import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TaxResult } from '@/types/tax';
import { COUNTRY_NAMES } from '@/lib/constants';

interface SPVStep {
  step: number;
  title: string;
  action: string;
  note?: string;
  details?: string[][];
}

function buildSPVSteps(result: TaxResult): SPVStep[] {
  const steps: SPVStep[] = [];
  const hasNonResident = result.capitalGains.some(cg => cg.brokerType === 'nonresident');
  const hasForeignDividends = result.dividends.details.length > 0;
  const hasCASS = result.cass.amount > 0;

  // Sectiuni de bifat
  const sections: string[] = [];
  if (hasNonResident) sections.push('Sectiunea 1, Subsectiunea 1 (Cat. 1.5 - Transfer titluri)');
  if (hasForeignDividends) sections.push('Sectiunea 2, Subsectiunea 1 (Venituri din strainatate)');
  if (hasCASS) sections.push('Sectiunea 3, Subsectiunea 2 (CASS)');
  sections.push('Sectiunea 7 (Sumar obligatii)');

  steps.push({
    step: 1,
    title: 'Acceseaza formularul D212',
    action: 'Mergi la anaf.ro → SPV → Depunere declaratii → Declaratia Unica (D212)',
    note: 'Autentificare cu user/parola SPV sau certificat digital',
  });

  steps.push({
    step: 2,
    title: 'Selecteaza anul fiscal',
    action: `Alege anul: ${result.fiscalYear}`,
    note: 'Bifeaza "Declaratie initiala" (sau "rectificativa" daca modifici o declaratie anterioara)',
  });

  steps.push({
    step: 3,
    title: 'Bifeaza sectiunile necesare',
    action: `Bifeaza EXACT urmatoarele sectiuni:`,
    details: sections.map(s => [s]),
    note: 'NU bifa sectiuni care nu te privesc!',
  });

  steps.push({
    step: 4,
    title: 'Completeaza datele de identificare',
    action: 'Completeaza: Nume, Prenume, Initiala tatalui, Adresa completa, Telefon, Email',
    note: 'Datele trebuie sa corespunda cu cele din cartea de identitate',
  });

  // Pas 5: Castiguri capital broker nerezident
  if (hasNonResident) {
    const nonResGains = result.capitalGains.filter(cg => cg.brokerType === 'nonresident');
    const totalGross = nonResGains.reduce((s, cg) => s + cg.totalGrossGain + cg.totalLoss, 0);
    const totalDeductible = nonResGains.reduce((s, cg) => {
      return s + cg.lots.reduce((ls, l) => ls + (l.buyPrice * l.quantity + l.buyCommission + l.sellCommission) * l.exchangeRateBuy, 0);
    }, 0);
    const netGain = nonResGains.reduce((s, cg) => s + Math.max(0, cg.netGain), 0);
    const taxable = nonResGains.reduce((s, cg) => s + cg.taxableGain, 0);
    const tax = nonResGains.reduce((s, cg) => s + cg.tax, 0);
    const carried = nonResGains.reduce((s, cg) => s + cg.carriedLossApplied, 0);

    steps.push({
      step: 5,
      title: 'Sectiunea 1 — Castiguri de capital (broker nerezident)',
      action: 'Click "Adauga venit" → Selecteaza Cat. 1.5',
      details: [
        ['Rd.1 — Venit brut', `${Math.round(totalGross).toLocaleString('ro-RO')} lei`],
        ['Rd.2 — Cheltuieli deductibile', `${Math.round(totalDeductible).toLocaleString('ro-RO')} lei`],
        ['Rd.3 — Castig net anual', `${Math.round(netGain).toLocaleString('ro-RO')} lei`],
        ['Rd.5 — Pierderi reportate', `${Math.round(carried).toLocaleString('ro-RO')} lei`],
        ['Rd.7 — Castig net impozabil', `${Math.round(taxable).toLocaleString('ro-RO')} lei`],
        ['Rd.9 — Impozit anual datorat', `${Math.round(tax).toLocaleString('ro-RO')} lei`],
      ],
      note: 'Determinarea venitului: "Sistem real". Forma de organizare: "Individual".',
    });
  }

  // Pas 6: Dividende straine
  if (hasForeignDividends) {
    const divByCountry = new Map<string, { gross: number; tax: number; wht: number; credit: number; due: number }>();
    for (const d of result.dividends.details) {
      const existing = divByCountry.get(d.country) ?? { gross: 0, tax: 0, wht: 0, credit: 0, due: 0 };
      existing.gross += d.grossAmountRON;
      existing.tax += d.taxRO;
      existing.wht += d.whtRON;
      existing.credit += d.taxCredit;
      existing.due += d.taxDue;
      divByCountry.set(d.country, existing);
    }

    const details: string[][] = [];
    for (const [country, data] of divByCountry) {
      const name = COUNTRY_NAMES[country] ?? country;
      details.push([`--- ${name} (${country}) ---`, '']);
      details.push(['Venit brut', `${Math.round(data.gross).toLocaleString('ro-RO')} lei`]);
      details.push(['Impozit datorat RO', `${Math.round(data.tax).toLocaleString('ro-RO')} lei`]);
      details.push(['WHT platit in strainatate', `${Math.round(data.wht).toLocaleString('ro-RO')} lei`]);
      details.push(['Credit fiscal', `${Math.round(data.credit).toLocaleString('ro-RO')} lei`]);
      details.push(['Diferenta de plata', `${Math.round(data.due).toLocaleString('ro-RO')} lei`]);
    }

    steps.push({
      step: steps.length + 1,
      title: 'Sectiunea 2 — Dividende din strainatate',
      action: 'Adauga CATE O SUBSECTIUNE per tara sursa',
      details,
      note: 'Cursul de conversie: mediu anual BNR. Creditul fiscal = min(WHT, Impozit RO).',
    });
  }

  // Pas 7: CASS
  if (hasCASS) {
    steps.push({
      step: steps.length + 1,
      title: 'Sectiunea 3 — CASS',
      action: 'Completeaza baza de calcul si CASS datorata',
      details: [
        ['Baza de calcul', `${result.cass.base.toLocaleString('ro-RO')} lei`],
        ['CASS datorata (10%)', `${result.cass.amount.toLocaleString('ro-RO')} lei`],
      ],
      note: `Venituri cumulate non-salariale: ${Math.round(result.cass.totalNonSalaryIncome).toLocaleString('ro-RO')} lei`,
    });
  }

  // Pas 8: Validare
  steps.push({
    step: steps.length + 1,
    title: 'Verifica sumarul si valideaza',
    action: `Click "Validare". Totaluri: Impozit = ${Math.round(result.totalCapitalGainsTax + result.totalDividendTax).toLocaleString('ro-RO')} lei, CASS = ${result.totalCASS.toLocaleString('ro-RO')} lei`,
    note: `TOTAL DE PLATA: ${Math.round(result.totalDue).toLocaleString('ro-RO')} lei`,
  });

  // Pas 9: Depunere
  steps.push({
    step: steps.length + 1,
    title: 'Genereaza PDF si depune',
    action: 'Click "Generare PDF" → "Depunere" → Confirma → Salveaza RECIPISA',
    note: 'PASTREAZA recipisa — e dovada depunerii!',
  });

  // Pas 10: Plata
  steps.push({
    step: steps.length + 1,
    title: 'Plateste',
    action: `Plata pana la ${result.deadline.payment} prin: SPV (plata online), ghiseupay.ro, sau transfer bancar`,
    note: 'Pastreaza dovada platii!',
  });

  return steps;
}

export function generateSPVGuidePDF(result: TaxResult): jsPDF {
  const steps = buildSPVSteps(result);
  const doc = new jsPDF('p', 'mm', 'a4');

  doc.setFontSize(16);
  doc.text('Ghid Completare D212 in SPV', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Anul fiscal: ${result.fiscalYear} | Total de plata: ${Math.round(result.totalDue).toLocaleString('ro-RO')} lei`, 105, 28, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`Termen: ${result.deadline.payment}`, 105, 33, { align: 'center' });

  let y = 42;

  for (const step of steps) {
    if (y > 250) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Pasul ${step.step}: ${step.title}`, 14, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(step.action, 18, y, { maxWidth: 170 });
    y += Math.ceil(step.action.length / 80) * 4 + 2;

    if (step.details && step.details.length > 0) {
      autoTable(doc, {
        startY: y,
        body: step.details,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
          1: { halign: 'right', cellWidth: 50 },
        },
        margin: { left: 20 },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 3;
    }

    if (step.note) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Nota: ${step.note}`, 18, y, { maxWidth: 170 });
      doc.setTextColor(0, 0, 0);
      y += Math.ceil(step.note.length / 80) * 3 + 4;
    }

    y += 3;
  }

  return doc;
}

export function downloadSPVGuidePDF(result: TaxResult): void {
  const doc = generateSPVGuidePDF(result);
  doc.save(`GHID_SPV_${result.fiscalYear}.pdf`);
}
