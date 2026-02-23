import jsPDF from 'jspdf';
import type { TaxResult } from '@/types/tax';
import type { UserProfile } from '@/types/d212';
import type { OtherIncome } from '@/types/transaction';
import { COUNTRY_NAMES, DIVIDEND_TAX, RATES_NONRESIDENT, SMB, CASS_RATE } from '@/lib/constants';

// ── Page dimensions (mm, A4) ──
const PW = 210;
const ML = 15; // margin left
const MT = 12; // margin top
const CW = PW - ML - 15; // content width = 180mm

// ── Colors [R, G, B] ──
type RGB = [number, number, number];
const ANAF_BLUE: RGB = [26, 60, 110];
const HEADER_BG: RGB = [232, 232, 232];
const GRAY_MID: RGB = [208, 208, 208];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

// ── Format number as Romanian lei (dot = thousands separator) ──
function fmt(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return '';
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ═══════════════════════════════════════
// Drawing helpers
// ═══════════════════════════════════════

function drawCheckbox(doc: jsPDF, x: number, y: number, checked: boolean, size = 3.5): void {
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.rect(x, y, size, size, 'S');
  if (checked) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('X', x + 0.8, y + size - 0.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
  }
}

function drawFieldBox(
  doc: jsPDF, x: number, y: number, w: number, h = 5,
  value = '', align: 'left' | 'right' | 'center' = 'left'
): void {
  doc.setDrawColor(...GRAY_MID);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, 'S');
  doc.setDrawColor(0);
  if (value) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const textY = y + h - 1.5;
    if (align === 'right') {
      doc.text(value, x + w - 1.5, textY, { align: 'right' });
    } else if (align === 'center') {
      doc.text(value, x + w / 2, textY, { align: 'center' });
    } else {
      doc.text(value, x + 1.5, textY);
    }
  }
}

function drawSectionHeader(doc: jsPDF, y: number, text: string, dark = false): number {
  const bgColor = dark ? ANAF_BLUE : HEADER_BG;
  const textColor = dark ? WHITE : BLACK;
  doc.setFillColor(...bgColor);
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(ML, y, CW, 6, 'FD');
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(text, ML + 2, y + 4.2);
  doc.setTextColor(0);
  return y + 6;
}

function drawRowLabelValue(
  doc: jsPDF, y: number, label: string, value: string,
  valueW = 55, rdNum?: string
): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  let x = ML + 2;
  if (rdNum) {
    doc.text(`${rdNum}.`, x, y + 3.5);
    x += 5;
  }
  doc.text(label, x, y + 3.5);

  // Value box on the right
  const vx = ML + CW - valueW;
  drawFieldBox(doc, vx, y, valueW, 5, value, 'right');

  // Dotted line between label and value box
  const labelWidth = doc.getTextWidth(label);
  doc.setDrawColor(...GRAY_MID);
  doc.setLineDashPattern([1, 2], 0);
  const lineStartX = x + labelWidth + 2;
  const lineEndX = vx - 2;
  if (lineEndX > lineStartX) {
    doc.line(lineStartX, y + 2.5, lineEndX, y + 2.5);
  }
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(0);

  return y + 6;
}

function drawPageHeader(doc: jsPDF, year: number, pageLabel: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(`DECLARATIA UNICA 212 — Anul ${year} — ${pageLabel}`, ML, MT);
  return MT + 10;
}

// ═══════════════════════════════════════
// Main PDF generator — replicates OPANAF 2736/2025 layout
// ═══════════════════════════════════════

export function generateD212PDF(
  result: TaxResult,
  userProfile: UserProfile,
  otherIncome?: OtherIncome
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({
    title: 'Declaratia Unica 212 - OPANAF 2736/2025',
    author: 'Calculator Impozite Investitii Romania',
    subject: `D212 pentru anul fiscal ${result.fiscalYear}`,
  });

  const year = result.fiscalYear;
  const rate = RATES_NONRESIDENT[year];
  const ratePercent = `${(rate * 100).toFixed(0)}%`;
  const divRate = DIVIDEND_TAX[year];
  const divRatePercent = `${(divRate * 100).toFixed(0)}%`;

  // ── Compute aggregated data ──

  // Capital gains (non-resident broker only — resident is withheld at source)
  const nonResidentGains = result.capitalGains.filter(cg => cg.brokerType === 'nonresident');
  const hasCapitalGains = nonResidentGains.length > 0 &&
    nonResidentGains.some(cg => cg.totalGrossGain > 0 || cg.totalLoss > 0);

  let capGross = 0, capDeductible = 0, capNet = 0, capLoss = 0;
  let capCarried = 0, capCarriedComp = 0, capTaxable = 0, capTax = 0;
  for (const cg of nonResidentGains) {
    capGross += cg.totalGrossGain + cg.totalLoss;
    capDeductible += cg.lots.reduce(
      (s, l) => s + (l.buyPrice * l.quantity + l.buyCommission + l.sellCommission) * l.exchangeRateBuy, 0
    );
    capNet += Math.max(0, cg.netGain);
    capLoss += cg.netGain < 0 ? Math.abs(cg.netGain) : 0;
    capCarried += cg.carriedLossApplied;
    capCarriedComp += cg.carriedLossApplied;
    capTaxable += cg.taxableGain;
    capTax += cg.tax;
  }

  // Crypto
  const cryptoGains = otherIncome?.cryptoGains ?? result.cass.breakdown.cryptoGains;
  const hasCrypto = cryptoGains > 0;
  const cryptoTax = Math.round(cryptoGains * rate);

  // Dividends grouped by country
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
  const hasDividends = divByCountry.size > 0;

  // CASS
  const hasCASS = result.cass.amount > 0;
  const smb = SMB[year];
  const cassThresholds = [6 * smb, 12 * smb, 24 * smb];

  // Deadline
  const deadlineYear = year + 1;
  const deadlineStr = `25 MAI ${deadlineYear}`;

  // ═══════════════════════════════════════
  // PAGINA 1 — Antet + Identificare + Secțiuni + Câștiguri de capital
  // ═══════════════════════════════════════
  let y = MT;

  // ── Antet oficial ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text('ANEXA Nr. 1 la OPANAF 2.736/2025', ML, y);
  y += 4;
  doc.text('Cod 14.13.01.13/1', ML, y);
  y += 8;

  // ── Titlu principal ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DECLARATIE UNICA 212', PW / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.text(
    'privind impozitul pe venit si contributiile sociale datorate de persoanele fizice',
    PW / 2, y, { align: 'center' }
  );
  y += 10;

  // ══════════════════════════════════════
  // A. DATE DE IDENTIFICARE
  // ══════════════════════════════════════
  y = drawSectionHeader(doc, y, 'A. DATE DE IDENTIFICARE A CONTRIBUABILULUI', true);
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);

  // Row 1: Nume, Initiala tatalui
  doc.text('Nume', ML, y + 3);
  drawFieldBox(doc, ML + 12, y, 65, 5.5, userProfile.nume);
  doc.text('Init. tatalui', ML + 82, y + 3);
  drawFieldBox(doc, ML + 103, y, 8, 5.5, userProfile.initialaTata, 'center');
  y += 7;

  // Row 2: Prenume
  doc.text('Prenume', ML, y + 3);
  drawFieldBox(doc, ML + 15, y, 65, 5.5, userProfile.prenume);
  y += 8;

  // Row 3: Strada, Nr, Bloc, Sc, Et
  doc.text('Strada', ML, y + 3);
  drawFieldBox(doc, ML + 13, y, 65, 5.5, userProfile.strada);
  doc.text('Nr.', ML + 82, y + 3);
  drawFieldBox(doc, ML + 90, y, 14, 5.5, userProfile.numar, 'center');
  doc.text('Bloc', ML + 108, y + 3);
  drawFieldBox(doc, ML + 118, y, 12, 5.5, userProfile.bloc, 'center');
  doc.text('Sc.', ML + 134, y + 3);
  drawFieldBox(doc, ML + 143, y, 10, 5.5, userProfile.scara, 'center');
  doc.text('Et.', ML + 157, y + 3);
  drawFieldBox(doc, ML + 165, y, 10, 5.5, userProfile.etaj, 'center');
  y += 7;

  // Row 4: Ap, Judet, Localitate, Cod postal
  doc.text('Ap.', ML, y + 3);
  drawFieldBox(doc, ML + 9, y, 10, 5.5, userProfile.apartament, 'center');
  doc.text('Judet/Sector', ML + 23, y + 3);
  drawFieldBox(doc, ML + 46, y, 18, 5.5, userProfile.judet, 'center');
  doc.text('Localitate', ML + 68, y + 3);
  drawFieldBox(doc, ML + 87, y, 40, 5.5, userProfile.localitate);
  doc.text('Cod postal', ML + 131, y + 3);
  drawFieldBox(doc, ML + 152, y, 24, 5.5, userProfile.codPostal, 'center');
  y += 7;

  // Row 5: Telefon, Email, IBAN
  doc.text('Telefon', ML, y + 3);
  drawFieldBox(doc, ML + 15, y, 35, 5.5, userProfile.telefon);
  doc.text('E-mail', ML + 55, y + 3);
  drawFieldBox(doc, ML + 68, y, 55, 5.5, userProfile.email);
  doc.text('IBAN', ML + 128, y + 3);
  drawFieldBox(doc, ML + 138, y, 38, 5.5, userProfile.iban, 'center');
  y += 12;

  // ══════════════════════════════════════
  // B. DATE PRIVIND SECTIUNILE COMPLETATE
  // ══════════════════════════════════════
  y = drawSectionHeader(doc, y, 'B. DATE PRIVIND SECTIUNILE COMPLETATE', true);
  y += 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CAPITOLUL I. DATE PRIVIND IMPOZITUL PE VENITURILE REALIZATE SI CONTRIBUTIILE', ML + 2, y);
  y += 4;
  doc.text(`SOCIALE DATORATE PENTRU ANUL ${year}`, ML + 2, y);
  y += 7;

  // Checkboxes sectiuni
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const i1 = ML + 4;
  const i2 = ML + 8;

  doc.text('SECTIUNEA 1: Date privind veniturile realizate din Romania', i1, y);
  y += 5;
  drawCheckbox(doc, i2, y, hasCapitalGains || hasCrypto);
  doc.text(
    'SUBSECTIUNEA 1: Date privind impozitul pe veniturile impuse in sistem real/pe baza cotelor forfetare',
    i2 + 5, y + 2.5
  );
  y += 6;

  doc.text('SECTIUNEA 2: Date privind veniturile realizate din strainatate', i1, y);
  y += 5;
  drawCheckbox(doc, i2, y, hasDividends);
  doc.text('SUBSECTIUNEA 1: Date privind impozitul pe veniturile din strainatate', i2 + 5, y + 2.5);
  y += 6;

  doc.text('SECTIUNEA 3: Date privind contributiile sociale datorate', i1, y);
  y += 5;
  drawCheckbox(doc, i2, y, hasCASS);
  doc.text('SUBSECTIUNEA 2: Date privind CASS datorata', i2 + 5, y + 2.5);
  y += 6;

  drawCheckbox(doc, i1, y, true);
  doc.text(
    'SECTIUNEA 7: Sumarul obligatiilor privind impozitul pe venitul realizat si contributiile sociale',
    i1 + 5, y + 2.5
  );
  y += 12;

  // Separator
  doc.setDrawColor(...ANAF_BLUE);
  doc.setLineWidth(1);
  doc.line(ML, y, ML + CW, y);
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  y += 8;

  // ══════════════════════════════════════
  // CAPITOLUL I — SECTIUNEA 1 — SUBSECTIUNEA 1
  // Transfer titluri de valoare (broker nerezident)
  // ══════════════════════════════════════
  if (hasCapitalGains) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CAPITOLUL I - SECTIUNEA 1 - SUBSECTIUNEA 1', ML, y);
    y += 5;
    doc.setFontSize(7);
    doc.text('Date privind impozitul pe veniturile impuse in sistem real', ML, y);
    y += 8;

    // A. DATE PRIVIND ACTIVITATEA
    y = drawSectionHeader(doc, y, 'A. DATE PRIVIND ACTIVITATEA DESFASURATA');
    y += 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('1. Categoria de venit:', ML + 2, y);
    y += 5.5;
    drawCheckbox(doc, ML + 6, y, true);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(
      '1.5. transferul titlurilor de valoare si orice alte operatiuni cu instrumente financiare,',
      ML + 11, y + 2.5
    );
    y += 4;
    doc.text(
      'inclusiv instrumente financiare derivate, precum si transferul aurului de investitii',
      ML + 16, y + 2
    );
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('2. Determinarea venitului net:', ML + 2, y);
    drawCheckbox(doc, ML + 42, y - 0.5, true);
    doc.text('sistem real', ML + 47, y + 2);
    drawCheckbox(doc, ML + 72, y - 0.5, false);
    doc.text('cote forfetare de cheltuieli', ML + 77, y + 2);
    y += 5.5;

    doc.text('3. Forma de organizare:', ML + 2, y);
    drawCheckbox(doc, ML + 38, y - 0.5, true);
    doc.text('individual', ML + 43, y + 2);
    y += 8;

    // B. DATE PRIVIND IMPOZITUL ANUAL DATORAT
    y = drawSectionHeader(doc, y,
      'B. DATE PRIVIND IMPOZITUL ANUAL DATORAT' +
      '                                                                            (lei)'
    );
    y += 2;

    y = drawRowLabelValue(doc, y, 'Venit brut', fmt(capGross), 55, '1');
    y = drawRowLabelValue(doc, y, 'Cheltuieli deductibile, potrivit legii', fmt(capDeductible), 55, '2');
    y = drawRowLabelValue(doc, y, 'Venit net anual / Castig net anual (rd.1 - rd.2)', fmt(capNet), 55, '3');
    y = drawRowLabelValue(doc, y, 'Pierdere fiscala anuala (rd.2 - rd.1)', fmt(capLoss), 55, '4');
    y = drawRowLabelValue(doc, y, 'Pierderi fiscale anuale reportate din anii precedenti', fmt(capCarried), 55, '5');
    y = drawRowLabelValue(doc, y, 'Pierdere fiscala compensata in anul de raportare', fmt(capCarriedComp), 55, '6');
    y = drawRowLabelValue(doc, y, 'Castig net anual impozabil (rd.3 - rd.6)', fmt(capTaxable), 55, '7');

    // Rd.8 — skip
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.text('8. Venit net anual impozabil redus — nu se completeaza', ML + 7, y + 3.5);
    y += 6;

    y = drawRowLabelValue(doc, y, `Impozit anual datorat (rd.7 x ${ratePercent})`, fmt(capTax), 55, '9');

    // Nota
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    y += 2;
    doc.text(
      `Nota: Impozit calculat la cota de ${ratePercent} conform art. 96 alin. (1) Cod Fiscal pentru anul ${year}.`,
      ML + 2, y
    );
    if (capCarried > 0) {
      y += 3.5;
      doc.text(
        'Pierderi reportate compensate in limita de 70% din castigul net anual.',
        ML + 2, y
      );
    }
  }

  // ═══════════════════════════════════════
  // PAGINA 2 — Crypto + Dividende străinătate
  // ═══════════════════════════════════════
  if (hasCrypto || hasDividends) {
    doc.addPage();
    y = drawPageHeader(doc, year, 'Pagina 2');

    // ── CRYPTO (art. 114 alin. 2 lit. m) ──
    if (hasCrypto) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('CAPITOLUL I - SECTIUNEA 1 - SUBSECTIUNEA 1 (sursa separata)', ML, y);
      y += 5;
      doc.setFontSize(7);
      doc.text('Venituri din alte surse — Criptomonede (art. 114 alin. (2) lit. m)', ML, y);
      y += 8;

      y = drawSectionHeader(doc, y, 'A. DATE PRIVIND ACTIVITATEA DESFASURATA');
      y += 2;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text('1. Categoria de venit:', ML + 2, y);
      y += 5.5;
      drawCheckbox(doc, ML + 6, y, true);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(
        '1.7.3. venituri prevazute la art. 114 alin. (2) lit. m) din Codul fiscal (criptomonede)',
        ML + 11, y + 2.5
      );
      y += 5.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text('2. Determinarea venitului net:', ML + 2, y);
      drawCheckbox(doc, ML + 42, y - 0.5, true);
      doc.text('sistem real', ML + 47, y + 2);
      y += 5.5;

      doc.text('3. Forma de organizare:', ML + 2, y);
      drawCheckbox(doc, ML + 38, y - 0.5, true);
      doc.text('individual', ML + 43, y + 2);
      y += 8;

      y = drawSectionHeader(doc, y,
        'B. DATE PRIVIND IMPOZITUL ANUAL DATORAT' +
        '                                                                            (lei)'
      );
      y += 2;

      y = drawRowLabelValue(doc, y, 'Venit brut', fmt(cryptoGains), 55, '1');
      y = drawRowLabelValue(doc, y, 'Cheltuieli deductibile, potrivit legii', '0', 55, '2');
      y = drawRowLabelValue(doc, y, 'Venit net anual / Castig net anual (rd.1 - rd.2)', fmt(cryptoGains), 55, '3');
      y = drawRowLabelValue(doc, y, `Impozit anual datorat (rd.3 x ${ratePercent})`, fmt(cryptoTax), 55, '9');

      y += 8;
    }

    // ── DIVIDENDE DIN STRAINATATE ──
    if (hasDividends) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('CAPITOLUL I - SECTIUNEA 2 - SUBSECTIUNEA 1', ML, y);
      y += 5;
      doc.setFontSize(7);
      doc.text('Date privind impozitul pe veniturile din strainatate', ML, y);
      y += 8;

      for (const [country, data] of divByCountry) {
        const countryName = COUNTRY_NAMES[country] ?? country;

        // Page break if needed (~70mm per country block)
        if (y > 220) {
          doc.addPage();
          y = drawPageHeader(doc, year, '(continuare)');
        }

        y = drawSectionHeader(doc, y, `A. DATE PRIVIND ACTIVITATEA — DIVIDENDE DIN ${countryName.toUpperCase()}`);
        y += 2;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text('Tara de sursa:', ML + 2, y);
        drawFieldBox(doc, ML + 28, y - 0.5, 35, 5.5, countryName);
        doc.text('Categoria de venit:', ML + 70, y);
        drawFieldBox(doc, ML + 100, y - 0.5, 40, 5.5, 'Dividende');
        y += 8;

        y = drawSectionHeader(doc, y,
          'B. DATE PRIVIND IMPOZITUL ANUAL DATORAT' +
          '                                                                            (lei)'
        );
        y += 2;

        y = drawRowLabelValue(doc, y, 'Venit brut (dividend brut in RON, curs mediu anual BNR)', fmt(data.gross), 55, '1');
        y = drawRowLabelValue(doc, y, 'Cheltuieli deductibile', '0', 55, '2');
        y = drawRowLabelValue(doc, y, 'Venit net anual', fmt(data.gross), 55, '3');
        y = drawRowLabelValue(doc, y, 'Venit net anual impozabil', fmt(data.gross), 55, '7');
        y = drawRowLabelValue(doc, y, `Impozit datorat in Romania (rd.7 x ${divRatePercent})`, fmt(data.tax), 55, '9');

        y += 3;
        y = drawSectionHeader(doc, y,
          'C. CREDIT FISCAL' +
          '                                                                                                                          (lei)'
        );
        y += 2;

        y = drawRowLabelValue(doc, y, `Impozit platit in strainatate (WHT ${country}), in RON`, fmt(data.wht));
        y = drawRowLabelValue(doc, y, 'Credit fiscal = min(impozit strain, impozit RO)', fmt(data.credit));
        y = drawRowLabelValue(doc, y, 'Diferenta de impozit de plata in Romania', fmt(data.due));

        // Note for this country
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(5.5);
        y += 2;
        doc.text(
          `Credit fiscal art. 131 = min(${fmt(data.wht)}, ${fmt(data.tax)}) = ${fmt(data.credit)} lei. ` +
          `Diferenta de plata: ${fmt(data.tax)} - ${fmt(data.credit)} = ${fmt(data.due)} lei.`,
          ML + 2, y
        );
        y += 8;
      }
    }
  }

  // ═══════════════════════════════════════
  // PAGINA 3 — CASS + SUMAR + SEMNATURA
  // ═══════════════════════════════════════
  doc.addPage();
  y = drawPageHeader(doc, year, 'Pagina 3');

  // ══════════════════════════════════════
  // SECTIUNEA 3 — CASS
  // ══════════════════════════════════════
  if (hasCASS) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CAPITOLUL I - SECTIUNEA 3 - SUBSECTIUNEA 2', ML, y);
    y += 5;
    doc.setFontSize(7);
    doc.text('Date privind contributia de asigurari sociale de sanatate (CASS) datorata', ML, y);
    y += 8;

    y = drawSectionHeader(doc, y,
      'CONTRIBUTIA DE ASIGURARI SOCIALE DE SANATATE (CASS) — 10%' +
      '                                      (lei)'
    );
    y += 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(
      `Salariul minim brut pe economie la 1 ianuarie ${year}: ${fmt(smb)} lei/luna`,
      ML + 2, y
    );
    y += 5;
    doc.text(
      `Plafoane CASS:  6 SMB = ${fmt(cassThresholds[0])} lei  |  ` +
      `12 SMB = ${fmt(cassThresholds[1])} lei  |  24 SMB = ${fmt(cassThresholds[2])} lei`,
      ML + 2, y
    );
    y += 8;

    y = drawRowLabelValue(doc, y, 'Total venituri nete cumulate non-salariale', fmt(result.cass.totalNonSalaryIncome));
    y += 2;

    // Incadrare plafon
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Incadrare in plafon:', ML + 2, y);
    y += 5.5;

    const income = result.cass.totalNonSalaryIncome;

    // Tier 1: < 6 SMB
    const t1Active = income < cassThresholds[0];
    drawCheckbox(doc, ML + 6, y, t1Active);
    doc.setFont('helvetica', t1Active ? 'bold' : 'normal');
    doc.text(
      `Sub ${fmt(cassThresholds[0])} lei (< 6 SMB) — CASS = 0 lei`,
      ML + 11, y + 2.5
    );
    y += 5;

    // Tier 2: 6-12 SMB
    const t2Active = income >= cassThresholds[0] && income < cassThresholds[1];
    drawCheckbox(doc, ML + 6, y, t2Active);
    doc.setFont('helvetica', t2Active ? 'bold' : 'normal');
    doc.text(
      `${fmt(cassThresholds[0])} - ${fmt(cassThresholds[1])} lei (6-12 SMB) — ` +
      `Baza = ${fmt(cassThresholds[0])} lei — CASS = ${fmt(Math.round(cassThresholds[0] * CASS_RATE))} lei`,
      ML + 11, y + 2.5
    );
    y += 5;

    // Tier 3: 12-24 SMB
    const t3Active = income >= cassThresholds[1] && income < cassThresholds[2];
    drawCheckbox(doc, ML + 6, y, t3Active);
    doc.setFont('helvetica', t3Active ? 'bold' : 'normal');
    doc.text(
      `${fmt(cassThresholds[1])} - ${fmt(cassThresholds[2])} lei (12-24 SMB) — ` +
      `Baza = ${fmt(cassThresholds[1])} lei — CASS = ${fmt(Math.round(cassThresholds[1] * CASS_RATE))} lei`,
      ML + 11, y + 2.5
    );
    y += 5;

    // Tier 4: > 24 SMB
    const t4Active = income >= cassThresholds[2];
    drawCheckbox(doc, ML + 6, y, t4Active);
    doc.setFont('helvetica', t4Active ? 'bold' : 'normal');
    doc.text(
      `Peste ${fmt(cassThresholds[2])} lei (> 24 SMB) — ` +
      `Baza = ${fmt(cassThresholds[2])} lei — CASS = ${fmt(Math.round(cassThresholds[2] * CASS_RATE))} lei (plafon maxim)`,
      ML + 11, y + 2.5
    );
    y += 8;

    doc.setFont('helvetica', 'normal');
    y = drawRowLabelValue(doc, y, 'Baza de calcul CASS', fmt(result.cass.base));
    y = drawRowLabelValue(doc, y, 'CASS datorata (10% x baza de calcul)', fmt(result.cass.amount));

    // Note CASS
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    y += 2;
    doc.text(
      'Nota: Titlurile de stat (Fidelis/Tezaur) sunt EXCLUSE din calculul CASS conform art. 93 Cod Fiscal.',
      ML + 2, y
    );
    y += 12;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      `SECTIUNEA 3 — CASS: Nu se datoreaza (venituri non-salariale sub plafonul de ${fmt(cassThresholds[0])} lei)`,
      ML, y
    );
    y += 12;
  }

  // ══════════════════════════════════════
  // SECTIUNEA 7 — SUMAR OBLIGATII
  // ══════════════════════════════════════
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CAPITOLUL I - SECTIUNEA 7', ML, y);
  y += 5;
  doc.setFontSize(7);
  doc.text(
    'Sumarul obligatiilor privind impozitul pe venitul realizat si contributiile sociale datorate',
    ML, y
  );
  y += 8;

  y = drawSectionHeader(doc, y,
    'SUMAR OBLIGATII DE PLATA' +
    '                                                                                                       (lei)',
    true
  );
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);

  if (hasCapitalGains) {
    y = drawRowLabelValue(doc, y,
      `Impozit pe castiguri de capital (broker nerezident, ${ratePercent})`,
      fmt(capTax)
    );
  }
  if (hasDividends) {
    y = drawRowLabelValue(doc, y,
      'Impozit pe dividende din strainatate (dupa credit fiscal)',
      fmt(result.dividends.totalTaxDue)
    );
  }
  if (hasCrypto) {
    y = drawRowLabelValue(doc, y,
      `Impozit pe venituri din criptomonede (${ratePercent})`,
      fmt(cryptoTax)
    );
  }
  y += 2;

  // Separator line
  doc.setLineWidth(0.8);
  doc.line(ML, y, ML + CW, y);
  y += 3;

  const totalImpozit = Math.round(capTax + result.dividends.totalTaxDue + cryptoTax);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  y = drawRowLabelValue(doc, y, 'TOTAL IMPOZIT PE VENIT DATORAT', fmt(totalImpozit));
  y = drawRowLabelValue(doc, y, 'TOTAL CASS DATORATA', fmt(result.totalCASS));
  y += 2;

  // ── Total final — evidențiat ──
  const totalGeneral = Math.round(totalImpozit + result.totalCASS);
  doc.setFillColor(...HEADER_BG);
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(ML, y, CW, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL GENERAL DE PLATA:', ML + 3, y + 5.5);
  doc.setFontSize(11);
  doc.text(`${fmt(totalGeneral)} lei`, ML + CW - 5, y + 5.5, { align: 'right' });
  y += 14;

  // Termen de plata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Termen de depunere si plata:', ML + 2, y);
  doc.setFontSize(9);
  doc.setTextColor(204, 0, 0);
  doc.text(deadlineStr, ML + 45, y);
  doc.setTextColor(0);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Modalitate depunere: online prin SPV (anaf.ro) sau pe hartie la registratura ANAF', ML + 2, y);
  y += 4;
  doc.text('Modalitate plata: SPV (plata online), ghiseupay.ro, sau transfer bancar', ML + 2, y);
  y += 12;

  // ══════════════════════════════════════
  // SEMNATURA
  // ══════════════════════════════════════
  doc.setLineWidth(0.5);
  doc.line(ML, y, ML + CW, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Declar ca datele inscrise in acest formular sunt corecte si complete.', ML + 2, y);
  y += 10;

  doc.text('Data:', ML + 2, y);
  drawFieldBox(doc, ML + 15, y - 2, 30, 5.5, `___.___.${deadlineYear}`);
  doc.text('Semnatura contribuabilului:', ML + 80, y);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(ML + 120, y + 1, ML + CW - 5, y + 1);
  doc.setLineDashPattern([], 0);
  y += 20;

  // ── Footer ──
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5);
  doc.setTextColor(128, 128, 128);
  doc.text(
    'Document generat automat de Calculator Impozite Investitii Romania — pe baza OPANAF 2.736/2025',
    ML, y
  );
  y += 3;
  doc.text(
    'Verificati intotdeauna cu un consultant fiscal inainte de depunerea declaratiei.',
    ML, y
  );
  y += 3;
  doc.text(
    `Legislatie aplicabila: Legea 227/2015 (Codul Fiscal), Legea 141/2025, Legea 239/2025, OUG 78/2025, OUG 89/2025`,
    ML, y
  );
  doc.setTextColor(0);

  return doc;
}

export function downloadD212PDF(
  result: TaxResult,
  userProfile: UserProfile,
  otherIncome?: OtherIncome
): void {
  const doc = generateD212PDF(result, userProfile, otherIncome);
  const filename = `D212_${result.fiscalYear}.pdf`;
  doc.save(filename);
}
