# CLAUDE.md — Calculator Impozite Investiții România (2025–2026)

## MISIUNE
Construiește un calculator web pentru persoane fizice rezidente fiscal în România care investesc local și internațional. Calculează: impozit pe câștiguri de capital, impozit pe dividende (cu credit fiscal), CASS, și generează un sumar D212.

## LEGISLAȚIE DE REFERINȚĂ
Codul Fiscal = Legea 227/2015, Titlul IV, Cap. V (art. 91–98).
Modificări cheie: Legea 141/2025 (dividende 16%), Legea 239/2025 (capital 3%/6%/16%, crypto 16%), OUG 78/2025, OUG 89/2025.

---

## CONSTANTE GLOBALE

```
SMB_2025 = 4050          // lei/lună, salariu minim brut
SMB_2026 = 4050          // lei/lună (din iulie 2026 = 4325, dar plafoanele CASS se calculează cu val. din 1 ianuarie)
CASS_RATE = 0.10         // 10%
CASS_THRESHOLDS = [6, 12, 24]  // multiplicatori SMB anual (× 12 × SMB)
// => 2025/2026: [24300, 48600, 97200] lei
```

---

## REGIM A — BROKER REZIDENT (TradeVille, Goldring, XTB RO, BT Capital, Swiss Capital)

Impozit REȚINUT LA SURSĂ per tranzacție. Pierderile = DEFINITIVE (necompensabile).

```
// Cote pe câștig brut per tranzacție
RATES_RESIDENT = {
  2025: { long: 0.01, short: 0.03 },   // long = deținere ≥ 365 zile
  2026: { long: 0.03, short: 0.06 }
}

// Formulă per tranzacție:
gain = sellPrice - fiscalValue
fiscalValue = buyPrice + buyCommission + sellCommission + exchangeFees
holdingDays = sellDate - buyDate  // FIFO pe fiecare simbol
rate = holdingDays >= 365 ? RATES_RESIDENT[year].long : RATES_RESIDENT[year].short
tax = gain > 0 ? gain * rate : 0  // pierdere = 0 impozit, pierdere DEFINITIVĂ
```

**NU se depune D212 pentru impozitul pe venit.** Se depune D212 DOAR pentru CASS dacă se depășesc pragurile.

---

## REGIM B — BROKER NEREZIDENT (Interactive Brokers, Trading 212, eToro, Revolut)

Impozit prin AUTO-IMPUNERE (D212). Pierderi COMPENSABILE.

```
RATES_NONRESIDENT = {
  2025: 0.10,  // 10%
  2026: 0.16   // 16%
}

// Câștig net anual (per țară sursă, per categorie venit):
netGainAnnual = Σ(gains) - Σ(losses)  // toate tranzacțiile din anul fiscal

// Reportare pierderi:
// Pierderi din 2024+: reportare 5 ani, compensabil max 70% din câștig net anual
// Pierderi pre-2024: reportare 7 ani, fără limita de 70%
taxableGain = max(0, netGainAnnual - carriedLosses)
tax = taxableGain * RATES_NONRESIDENT[year]

// Pierdere netă anuală = se reportează
carriedLoss = netGainAnnual < 0 ? abs(netGainAnnual) : 0
```

**Obligatoriu D212.**

---

## IMPOZIT PE DIVIDENDE

```
DIVIDEND_TAX = {
  2023: 0.08, 2024: 0.08,
  2025: 0.10,
  2026: 0.16   // Legea 141/2025
}
```

### Dividende românești
Reținut la sursă de companie. Impozit FINAL. Nu se declară.

### Dividende străine — cu CREDIT FISCAL (art. 131)
```
grossDividendRON = grossDividendFX * exchangeRate  // curs mediu anual BNR
taxRO = grossDividendRON * DIVIDEND_TAX[year]
withheldAbroad = whtAmountFX * exchangeRate
taxCredit = min(withheldAbroad, taxRO)
taxDue = max(0, taxRO - taxCredit)
```

**Exemplu 2026**: 1000 USD dividend SUA, WHT 10%, curs 4.60:
- taxRO = 4600 × 0.16 = 736
- credit = min(460, 736) = 460
- taxDue = 276 lei

**ATENȚIE**: Dacă WHT străin > cota RO → taxDue = 0, dar excedentul NU se restituie de ANAF. Trebuie recuperat din statul sursă.

---

## WHT PE ȚĂRI (ratele din tratate, pentru dividende)

```
WHT_RATES = {
  US:  { withW8BEN: 0.10, without: 0.30 },
  IE:  { ucits: 0.00, direct: 0.03 },
  LU:  { fund: 0.00, direct: 0.15 },
  DE:  0.15,
  UK:  0.00,   // UK nu reține WHT pe dividende
  NL:  0.15,
  FR:  0.10,
  AT:  0.05
}
```

W-8BEN: obligatoriu pt dividende SUA. Fără = 30% WHT. Cu = 10%. Valabilitate: 3 ani.

---

## CASS (Contribuție Sănătate) — 10% pe plafoane fixe

```
function calcCASS(totalNonSalaryIncome, year) {
  const smb = year <= 2026 ? 4050 : GET_CURRENT_SMB
  const annual = 12 * smb  // = 48600
  const thresholds = [6 * annual / 12, 12 * annual / 12, 24 * annual / 12]
  // = [24300, 48600, 97200] pentru 2025-2026

  if (totalNonSalaryIncome < thresholds[0]) return 0
  if (totalNonSalaryIncome < thresholds[1]) return thresholds[0] * 0.10  // 2430
  if (totalNonSalaryIncome < thresholds[2]) return thresholds[1] * 0.10  // 4860
  return thresholds[2] * 0.10  // 9720 = plafon maxim
}
```

### Ce INTRĂ în venitul cumulat CASS:
- Câștiguri de capital (brut pt broker RO, net pt broker străin)
- Dividende nete (după impozit la sursă)
- Dobânzi nete (depozite, obligațiuni corp.)
- Venituri crypto
- Chirii, drepturi de autor, agricultură, alte venituri extrasalariale

### Ce NU intră:
- Dobânzi/câștiguri din TITLURI DE STAT (Fidelis, Tezaur) = EXCLUSE complet
- Salarii (se calculează separat)

### Regula critică:
CASS se datorează CHIAR DACĂ impozitul pe venit a fost reținut la sursă. Dacă pragul e depășit → obligatoriu D212 pentru CASS.

---

## CAS (Contribuție Pensii) — 25%

**NU SE APLICĂ veniturilor din investiții.** Niciodată. Zero. Exclus complet.
(Se aplică doar la PFA/activități independente.)

---

## TRATAMENT PE INSTRUMENTE — LOOKUP TABLE

```
INSTRUMENTS = {
  // [taxType, residentRate, nonresidentRate, cassApplies, lossOffset, d212Required]

  "stocks_bvb":        ["capital", "3/6%", null,   true,  false, "only_cass"],
  "stocks_intl":       ["capital", "3/6%", "16%",  true,  true,  true],
  "dividends_ro":      ["dividend", "16%", null,   true,  false, "only_cass"],
  "dividends_intl":    ["dividend", null,   "16%", true,  false, true],       // + credit fiscal
  "etf_acc":           ["capital", "3/6%", "16%",  true,  true,  true],       // dividende reinvestite = NEIMPOZABILE
  "etf_dist_divs":     ["dividend", "16%", "16%",  true,  false, true],
  "etf_dist_capital":  ["capital", "3/6%", "16%",  true,  true,  true],
  "gov_bonds":         ["exempt",  "0%",   null,   false, false, false],      // COMPLET SCUTIT
  "corp_bonds_ro":     ["interest","10%",  "10%",  true,  false, "only_cass"],
  "bonds_intl":        ["interest+capital", null, "10%+16%", true, true, true],
  "crypto":            ["other",   null,   "16%",  true,  true,  true],       // prag: <200lei/trx, <600lei/an = scutit
  "options_futures":   ["derivative","3/6%","16%",  true,  true,  true],
  "cfd":               ["derivative","3/6%","16%",  true,  true,  true],
  "mutual_funds_ro":   ["capital", "3/6%", null,    true, false, "only_cass"], // metoda PMP (nu FIFO)
  "mutual_funds_intl": ["capital", null,   "16%",   true, true,  true],
  "bank_interest":     ["interest","10%",  null,    true, false, "only_cass"],
}
```

### Note speciale:
- **Titluri de stat**: 0% impozit, 0% CASS — cel mai eficient instrument fiscal
- **ETF acumulare**: dividendele reinvestite de fond NU generează eveniment fiscal → impozit doar la vânzare
- **ETF distribuție**: 2 impozite — pe distribuții (16%) + pe câștig capital la vânzare
- **Crypto prag neimpozabil**: câștig < 200 lei/tranzacție ȘI total < 600 lei/an → SCUTIT
- **Fonduri mutuale RO**: metoda PMP (Preț Mediu Ponderat), nu FIFO
- **Staking/DeFi**: impozabil la primire (valoare piață RON), bază cost = val. la primire

---

## CONVERSIE VALUTARĂ

```
// Pt câștiguri/pierderi din tranzacții:
exchangeRate = BNR_RATE(transactionDate)  // cursul BNR din ziua tranzacției

// Pt credit fiscal (dividende/dobânzi din străinătate):
exchangeRate = BNR_ANNUAL_AVERAGE(year)   // cursul mediu anual BNR

// Valute necotate BNR: convertește mai întâi în USD/EUR la cursul țării sursă, apoi în RON
// Sursa: bnr.ro
// Rotunjire: la RON întreg (≥ 0.50 = sus)
```

---

## COMPENSARE PIERDERI (doar Regim B — broker nerezident)

```
// Per țară sursă, per categorie venit
// Pierderi din 2024+:
//   - reportare 5 ani consecutivi
//   - compensabil max 70% din câștigul net anual viitor
// Pierderi pre-2024:
//   - reportare 7 ani consecutivi
//   - fără limita de 70%

// Pierderi din Regim A (broker rezident): DEFINITIVE, NECOMPENSABILE, NEREPORTABILE
```

**WASH SALES**: România NU are reguli wash sale. Vânzare în pierdere + recumpărare imediată = OK fiscal.

---

## DECLARAȚIA UNICĂ (D212)

```
DEADLINES = {
  "venituri_2025": { filing: "2026-05-25", payment: "2026-05-25" },
  "venituri_2026": { filing: "2027-05-25", payment: "2027-05-25" }
}
```

### Cine depune:
1. Oricine cu câștiguri prin broker NEREZIDENT
2. Oricine cu dividende din STRĂINĂTATE
3. Oricine cu venituri CRYPTO
4. Oricine cu venituri non-salariale cumulate > 24.300 lei (pentru CASS)

### Cine NU depune (pentru impozit pe venit):
- Investitor DOAR prin broker rezident + venituri sub 24.300 lei

---

## CAZURI SPECIALE

| Caz | Regulă |
|-----|--------|
| Transfer între brokeri | NU e eveniment fiscal. Se păstrează baza de cost + perioadă deținere |
| Moștenire acțiuni | Neimpozabil la transfer. Bază cost = prețul defunctului (sau 0 fără documente) |
| Donație acțiuni | Neimpozabil la transfer. Bază cost = ZERO (dezavantajos vs moștenire!) |
| PFA pt investiții | Rar avantajos: adaugă CAS 25%. OK doar pt traderi activi cu cheltuieli mari |
| DRIP (reinvestire auto) | Dividendele reinvestite = IMPOZABILE (sunt considerate încasate) |
| Day trading | Fără reguli speciale. Broker RO: 6%/trx fără compensare. Broker străin: 16% net cu compensare |

---

## FLOW CALCUL COMPLET (PSEUDOCOD)

```
function calculateTaxes(transactions, dividends, otherIncome, year, brokerType) {

  // 1. CAPITAL GAINS TAX
  if (brokerType === 'resident') {
    // Per tranzacție, FIFO
    for each sale:
      gain = salePrice - fiscalValue(FIFO)
      if gain > 0:
        rate = holdingDays >= 365 ? RATES_RESIDENT[year].long : RATES_RESIDENT[year].short
        capitalTax += gain * rate
      // gain <= 0: pierdere definitivă, ignoră

  } else { // nerezident
    // Net anual per țară
    netGain = Σ(gains) - Σ(losses) - carriedLosses
    if netGain > 0:
      capitalTax = netGain * RATES_NONRESIDENT[year]
    else:
      newCarriedLoss = abs(netGain)
  }

  // 2. DIVIDEND TAX (străinătate)
  for each foreignDividend:
    grossRON = grossAmount * exchangeRate(annualAvg)
    taxRO = grossRON * DIVIDEND_TAX[year]
    whtRON = whtAmount * exchangeRate(annualAvg)
    credit = min(whtRON, taxRO)
    dividendTax += max(0, taxRO - credit)

  // 3. CASS
  cassIncome = capitalGainsForCASS + netDividends + netInterest + cryptoGains + rentalIncome + otherIncome
  // Exclude: titluri de stat
  // capitalGainsForCASS: brut pt broker RO, net pt broker străin
  cassAmount = calcCASS(cassIncome, year)

  // 4. TOTAL
  return {
    capitalGainsTax,     // reținut la sursă (RO) sau de plată prin D212 (străin)
    dividendTax,         // de plată prin D212 (străinătate) sau reținut (RO)
    cassAmount,          // de plată prin D212
    totalDue: capitalGainsTax + dividendTax + cassAmount,
    d212Required: /* true dacă broker străin SAU dividende străine SAU crypto SAU cassIncome > 24300 */,
    deadline: DEADLINES[`venituri_${year}`]
  }
}
```

---

## EXPORT D212 — PDF PRE-COMPLETAT + GHID SPV

### Context tehnic
Din 2025-2026, D212 se completează pe anaf.ro/declaratii/duf (aplicație web) SAU prin PDF-ul oficial (OPANAF 2736/2025). PDF-ul generat include XML integrat — se uploadează direct în SPV. Calculatorul nostru oferă DOUĂ output-uri:

### OUTPUT 1: PDF PRE-COMPLETAT (gata de print sau upload SPV)

Generăm un PDF care replică structura oficială D212. Câmpurile pe care le completăm automat:

**A. DATE DE IDENTIFICARE** (din profilul utilizatorului)
```
- Nume, Prenume, Inițiala tatălui
- CNP (Cod de identificare fiscală) — 13 cifre
- Adresă completă (Stradă, Nr, Bloc, Scară, Etaj, Ap, Județ/Sector, Localitate, Cod poștal)
- Telefon, E-mail
- Cont bancar IBAN (opțional)
```

**B. DATE PRIVIND SECȚIUNILE COMPLETATE** (bifăm automat)
```
Capitolul I = ÎNTOTDEAUNA bifat pentru investitori
Anul = anul fiscal declarat (2025 sau 2026)

Secțiuni relevante pentru investiții — bifăm AUTOMAT ce e cazul:
├── SECȚIUNEA 1, SUBSECȚIUNEA 1 → dacă are venituri din:
│   ├── Categoria 1.5: "transfer titluri de valoare și orice alte operațiuni cu instrumente financiare,
│   │    inclusiv instrumente financiare derivate, precum și transferul aurului de investiții"
│   │    → pt câștiguri de capital prin broker NEREZIDENT
│   ├── Categoria 1.6: "dobânzi plătite de PJ rezidente în RO, pentru obligațiuni emise pe piețe
│   │    de capital din afara României"
│   │    → pt obligațiuni corp. RO pe piețe externe (art. 97¹)
│   └── Categoria 1.7.3: "venituri prevăzute la art. 114 alin. (2) lit. m)"
│        → pt CRIPTOMONEDE
│
├── SECȚIUNEA 2, SUBSECȚIUNEA 1 → dacă are venituri din STRĂINĂTATE:
│   ├── Dividende din străinătate
│   ├── Dobânzi din obligațiuni internaționale
│   └── Câștiguri de capital din broker nerezident (dacă sursa e din altă țară)
│
├── SECȚIUNEA 3, SUBSECȚIUNEA 2 → CASS datorată
│   → bifat DOAR dacă venituri cumulate non-salariale ≥ 24.300 lei
│
└── SECȚIUNEA 7 → Sumarul obligațiilor (ÎNTOTDEAUNA)
```

**SECȚIUNEA 1, SUBSECȚIUNEA 1 — Câmpuri per sursă de venit**
Se completează CÂTE O SUBSECȚIUNE pentru fiecare categorie + sursă (ex: câștiguri capital + acțiuni intl, separat de crypto).

```
Per subsecțiune completăm:
- Categoria de venit: bifăm 1.5 sau 1.7.3
- Determinarea venitului net: "sistem real" = bifat
- Forma de organizare: "individual" = bifat

B. DATE PRIVIND IMPOZITUL ANUAL DATORAT:
  Rd.1  Venit brut = Σ(prețuri vânzare) în RON
  Rd.2  Cheltuieli deductibile = Σ(prețuri achiziție + comisioane) în RON  
  Rd.3  Venit net anual / Câștig net anual = Rd.1 - Rd.2 (doar dacă > 0)
  Rd.4  Pierdere fiscală anuală = Rd.2 - Rd.1 (doar dacă Rd.2 > Rd.1)
  Rd.5  Pierderi fiscale anuale reportate din anii precedenți = pierderile reportate
  Rd.6  Pierdere fiscală compensată = min(Rd.5, 70% × Rd.3)
  Rd.7  Câștig net anual impozabil = Rd.3 - Rd.6
  Rd.9  Impozit anual datorat = Rd.7 × cotă (10% pt 2025, 16% pt 2026)
```

**SECȚIUNEA 2, SUBSECȚIUNEA 1 — Venituri din străinătate**
Se completează per țară sursă + categorie venit.

```
Per subsecțiune completăm:
- Țara de sursă (cod ISO)
- Categoria de venit (dividende / câștiguri capital / dobânzi)
  
  Rd.1  Venit brut = suma brută în RON (curs mediu anual BNR)
  Rd.2  Cheltuieli deductibile (pt capital gains)
  Rd.3  Venit net anual
  Rd.7  Venit net impozabil
  Rd.9  Impozit datorat în RO = Rd.7 × cotă
  
  + Creditul fiscal:
  - Impozit plătit în străinătate (WHT) convertit în RON
  - Credit fiscal = min(WHT_RON, Impozit_RO)
  - Diferență de plată = Impozit_RO - Credit fiscal
```

**SECȚIUNEA 3, SUBSECȚIUNEA 2 — CASS**
```
Baza de calcul = plafonul aplicabil (24.300 / 48.600 / 97.200)
CASS datorată = Baza × 10%
```

**SECȚIUNEA 7 — SUMAR**
```
Total impozit pe venit datorat = Σ(impozite din Secț.1 + Secț.2)
Total CASS datorată = din Secț.3
TOTAL DE PLATĂ = impozit + CASS
Termen de plată = 25 mai [anul următor]
```

### OUTPUT 2: GHID PAS-CU-PAS PENTRU SPV

Generăm un document interactiv (HTML/PDF) cu instrucțiuni vizuale:

```
GHID SPV = [
  {
    step: 1,
    title: "Accesează formularul D212",
    action: "Mergi la anaf.ro/declaratii/duf SAU anaf.ro → SPV → Depunere Declarație Unică",
    note: "Autentificare cu user/parolă SPV"
  },
  {
    step: 2,  
    title: "Selectează anul fiscal",
    action: "Alege anul: ${fiscalYear}",
    note: "Bifează 'Declarație inițială' (sau 'rectificativă' dacă modifici)"
  },
  {
    step: 3,
    title: "Bifează secțiunile necesare",
    action: "Bifează exact: ${checkedSections.join(', ')}",
    note: "NU bifa secțiuni care nu te privesc"
  },
  {
    step: 4,
    title: "Completează datele de identificare",
    fields: { CNP, Nume, Prenume, Adresa, ... }
  },
  {
    step: 5,
    title: "Adaugă venituri din investiții",
    action: "Click 'Adaugă venit' pentru fiecare categorie",
    substeps: [
      // Generat dinamic per instrument/broker/țară
      {
        category: "1.5 - Transfer titluri de valoare",
        fields: {
          "Venit brut (Rd.1)": "${calculatedValues.grossIncome} lei",
          "Cheltuieli deductibile (Rd.2)": "${calculatedValues.deductible} lei",
          "Câștig net (Rd.3)": "${calculatedValues.netGain} lei",
          "Pierderi reportate (Rd.5)": "${calculatedValues.carriedLosses} lei",
          "Impozit datorat (Rd.9)": "${calculatedValues.taxDue} lei"
        }
      },
      // ... câte o subsecțiune per sursă
    ]
  },
  {
    step: 6,
    title: "Completează CASS (dacă e cazul)",
    condition: "cassAmount > 0",
    fields: {
      "Baza de calcul": "${cassBase} lei",
      "CASS datorată": "${cassAmount} lei"
    }
  },
  {
    step: 7,
    title: "Verifică sumarul și validează",
    action: "Click 'Validare'. Verifică totalurile: Impozit = ${totalTax} lei, CASS = ${cassAmount} lei",
  },
  {
    step: 8,
    title: "Generează PDF și depune",
    action: "Click 'Generare PDF' → 'Depunere' → Confirmă → Salvează RECIPISA",
    note: "PĂSTREAZĂ recipisa — e dovada depunerii!"
  },
  {
    step: 9,
    title: "Plătește",
    action: "Plata se face până la ${deadline} prin: SPV (plata online), ghiseupay.ro, sau transfer bancar",
    note: "Cont IBAN ANAF pentru impozit pe venit: RO..., pentru CASS: RO..."
  }
]
```

### IMPLEMENTARE TEHNICĂ

**PDF Generation:**
```
// Folosim jsPDF sau pdf-lib
// Template = replica vizuală a D212 oficială (OPANAF 2736/2025)
// Font: Arial/Helvetica (cel mai apropiat de formularul ANAF)
// Dimensiuni: A4 portrait
// Câmpuri completate = text overlay pe pozițiile exacte din template
// Checkbox-uri = caractere "X" pe pozițiile corecte

// ALTERNATIVĂ SIMPLIFICATĂ (recomandat MVP):
// Generăm un PDF SUMAR (nu replica exactă a formularului) cu:
// - Toate valorile calculate, organizate pe secțiunile D212
// - Instrucțiuni clare "completează Rd.X cu valoarea Y"
// - Totalizatoare
// Avantaj: nu trebuie să replicăm pixel-perfect formularul ANAF
```

**Buton descărcare:**
```jsx
<Button onClick={downloadD212PDF}>
  📄 Descarcă PDF D212 Pre-completat
</Button>
<Button onClick={downloadSPVGuide}>
  📋 Descarcă Ghid Completare SPV
</Button>
```

**Structura fișierelor generate:**
```
D212_${cnp}_${year}.pdf     → PDF cu valorile calculate, gata de referință
GHID_SPV_${year}.pdf        → Ghid pas-cu-pas personalizat cu valorile investitorului
CALCUL_DETALIAT_${year}.pdf → Breakdown complet pe instrumente (opțional, pt audit trail)
```

---

## ARHITECTURA PROIECT — STRUCTURA `src/`

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout + providers
│   ├── page.tsx                  # Landing / hero page
│   ├── calculator/
│   │   ├── page.tsx              # Wizard container
│   │   └── results/
│   │       └── page.tsx          # Rezultate + export D212
│   ├── api/
│   │   └── bnr/
│   │       └── route.ts          # Proxy cursuri BNR (cache server-side)
│   └── globals.css
│
├── components/
│   ├── wizard/                   # Steps wizard
│   │   ├── WizardContainer.tsx   # State machine wizard (step tracking)
│   │   ├── Step1_FiscalYear.tsx  # Alege an fiscal (2025/2026)
│   │   ├── Step2_Brokers.tsx     # Adaugă brokeri (rezident/nerezident, multi-broker)
│   │   ├── Step3_Import.tsx      # Upload CSV SAU input manual — BRANCH POINT
│   │   ├── Step4_Transactions.tsx# Editare/review tranzacții (tabel editabil)
│   │   ├── Step5_Dividends.tsx   # Dividende (RO + străinătate + WHT)
│   │   ├── Step6_OtherIncome.tsx # Crypto, dobânzi, chirii, alte venituri (pt CASS)
│   │   └── Step7_Review.tsx      # Sumar înainte de calcul
│   ├── results/
│   │   ├── TaxBreakdown.tsx      # Breakdown vizual pe instrumente
│   │   ├── CASSBreakdown.tsx     # Vizualizare plafoane CASS
│   │   ├── D212Preview.tsx       # Preview PDF D212 inline
│   │   ├── SPVGuide.tsx          # Ghid pas-cu-pas SPV
│   │   ├── BrokerComparator.tsx  # Comparator broker RO vs străin (aceleași tranzacții)
│   │   └── ExportButtons.tsx     # Butoane descărcare (D212 PDF, Ghid SPV, CSV detaliat)
│   └── ui/                       # Componente shared (Button, Input, Card, FileUpload, etc.)
│
├── lib/
│   ├── tax/                      # CORE — motorul fiscal (ZERO dependințe de UI)
│   │   ├── engine.ts             # Funcția principală calculateTaxes() — orchestrator
│   │   ├── capital-gains.ts      # Regim A (per tranzacție) + Regim B (net anual)
│   │   ├── dividends.ts          # Impozit dividende + credit fiscal
│   │   ├── cass.ts               # Calcul CASS pe plafoane
│   │   ├── loss-carry.ts         # Compensare și reportare pierderi
│   │   ├── fifo.ts               # Algoritm FIFO (matching buy→sell per simbol)
│   │   └── crypto.ts             # Logica specifică crypto (prag 200/600, staking)
│   │
│   ├── parsers/                  # Parseri rapoarte brokeri → NormalizedTransaction[]
│   │   ├── types.ts              # Interfața comună NormalizedTransaction
│   │   ├── detect.ts             # Auto-detectare broker din header CSV
│   │   ├── ibkr.ts               # Interactive Brokers parser
│   │   ├── trading212.ts         # Trading 212 parser
│   │   ├── revolut.ts            # Revolut parser
│   │   ├── xtb.ts                # XTB parser
│   │   ├── tradeville.ts         # TradeVille parser
│   │   └── index.ts              # Export unificat: parseCSV(file) → NormalizedTransaction[]
│   │
│   ├── pdf/                      # Generare documente
│   │   ├── d212-pdf.ts           # Generare PDF D212 pre-completat
│   │   ├── spv-guide.ts          # Generare ghid SPV personalizat
│   │   └── detail-report.ts     # Raport detaliat tranzacții (audit trail)
│   │
│   ├── bnr/                      # Cursuri valutare BNR
│   │   ├── rates.ts              # Fetch + cache cursuri zilnice + medii anuale
│   │   └── convert.ts            # Conversie valutară cu regulile corecte
│   │
│   └── constants.ts              # TOATE constantele fiscale — UN SINGUR FIȘIER
│                                 # (cote, praguri, WHT, SMB — ușor de actualizat anual)
│
├── types/
│   ├── tax.ts                    # TaxResult, CapitalGainResult, DividendResult, CASSResult
│   ├── transaction.ts            # Transaction, Dividend, OtherIncome
│   ├── broker.ts                 # BrokerType, BrokerConfig
│   └── d212.ts                   # D212Data, D212Section, SPVStep
│
└── hooks/
    ├── useCalculator.ts          # Hook principal — state management calcul
    ├── useFileUpload.ts          # Hook upload + parsing CSV
    └── useBNRRates.ts            # Hook fetch cursuri BNR
```

### Principii arhitecturale:
- `lib/tax/` = **ZERO import-uri din React**. Funcții pure, testabile independent.
- `lib/parsers/` = **ZERO cunoștințe fiscale**. Transformă CSV → structură standard. Atât.
- `lib/constants.ts` = **SINGURUL fișier de modificat** când se schimbă legislația.
- Wizard = **state machine**, nu logică imperativă. Fiecare step e independent.
- Multi-broker = un utilizator poate avea 3 brokeri diferiți în același an fiscal.

---

## IMPORT RAPOARTE BROKERI — PARSERI CSV

### Interfața comună (ținta tuturor parserilor)

```typescript
// src/lib/parsers/types.ts

interface NormalizedTransaction {
  id: string                    // UUID generat
  date: Date                    // Data tranzacției
  type: 'buy' | 'sell'         // Tip operațiune
  symbol: string                // Ticker (AAPL, VWCE.DE, etc.)
  isin?: string                 // ISIN dacă e disponibil
  quantity: number              // Număr unități
  pricePerUnit: number          // Preț per unitate în valuta originală
  totalAmount: number           // Valoare totală
  commission: number            // Comision total (buy sau sell)
  currency: string              // Valuta (USD, EUR, GBP, RON)
  exchangeRate?: number         // Cursul dat de broker (dacă există)
  instrumentType: InstrumentType // Clasificare automată
}

interface NormalizedDividend {
  id: string
  date: Date                    // Data plății
  symbol: string
  grossAmount: number           // Dividend brut
  whtAmount: number             // Impozit reținut la sursă (WHT)
  netAmount: number             // Dividend net primit
  currency: string
  country: string               // Țara sursă (ISO 2-letter: US, IE, DE, GB...)
}

interface NormalizedInterest {
  id: string
  date: Date
  grossAmount: number
  whtAmount: number
  currency: string
  source: string                // "bond_coupon" | "cash_interest" | "other"
}

type InstrumentType =
  | 'stock' | 'etf_acc' | 'etf_dist' | 'bond_gov'
  | 'bond_corp' | 'option' | 'future' | 'cfd'
  | 'mutual_fund' | 'crypto'

interface ParseResult {
  broker: BrokerName
  transactions: NormalizedTransaction[]
  dividends: NormalizedDividend[]
  interests: NormalizedInterest[]
  warnings: string[]            // Rânduri neparsate, date ambigue etc.
  currency: string              // Valuta principală a contului
  period: { from: Date, to: Date }
}
```

### Auto-detectare broker

```typescript
// src/lib/parsers/detect.ts

function detectBroker(headerRow: string): BrokerName | null {
  const h = headerRow.toLowerCase()
  
  // IBKR: header-ul conține "ClientAccountID" sau "Statement" section markers
  if (h.includes('clientaccountid') || h.includes('header,') || h.includes('trades,header'))
    return 'ibkr'
  
  // Trading 212: header exact "Action,Time,ISIN,Ticker,Name,No. of shares,Price / share..."
  if (h.includes('action') && h.includes('ticker') && h.includes('no. of shares'))
    return 'trading212'
  
  // Revolut: header "Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate"
  if (h.includes('price per share') && h.includes('fx rate'))
    return 'revolut'
  
  // XTB: header conține "Symbol", "Type", "Open price", "Close price"
  if (h.includes('open price') && h.includes('close price') && h.includes('symbol'))
    return 'xtb'
  
  // TradeVille: header conține "Simbol", "Piata", "Cantitate", "Pret"
  if (h.includes('simbol') && (h.includes('piata') || h.includes('cantitate')))
    return 'tradeville'
  
  return null // necunoscut → prompt utilizator să selecteze manual
}
```

### Parser IBKR (Interactive Brokers) — PRIORITATE 1

```typescript
// src/lib/parsers/ibkr.ts
// Format: Activity Statement CSV (multi-section)
// Secțiuni relevante: "Trades", "Dividends", "Withholding Tax", "Interest"
// Structura: fiecare secțiune are propriul header
// ATENȚIE: IBKR CSV are secțiuni marcate cu "Trades,Header,..." apoi "Trades,Data,..."

// Trades section columns:
// DataDiscriminator, AssetCategory, Currency, Symbol, DateTime, Quantity,
// T.Price, C.Price, Proceeds, Comm/Fee, Basis, RealizedP/L, Code

// Mapping:
// date = DateTime (format: "YYYY-MM-DD, HH:MM:SS" sau "YYYYMMDD")
// type = Quantity > 0 ? 'buy' : 'sell'
// symbol = Symbol
// quantity = abs(Quantity)
// pricePerUnit = T.Price
// totalAmount = abs(Proceeds)
// commission = abs(Comm/Fee)
// currency = Currency
// instrumentType = mapAssetCategory(AssetCategory)
//   "STK" → 'stock', "OPT" → 'option', "FUT" → 'future',
//   "CFD" → 'cfd', "BOND" → 'bond_corp'

// Dividends section columns:
// Currency, Date, Description, Amount
// Description format: "AAPL(US0378331005) Cash Dividend USD 0.25 per Share (Ordinary Dividend)"
// → parse symbol, country (din ISIN primele 2 litere), amount

// Withholding Tax section columns:
// Currency, Date, Description, Amount (negativ = WHT reținut)
// → match cu dividendul corespunzător pe symbol + date

// IBKR poate exporta și XML (FlexQuery) — mai ușor de parsat dar necesită setup suplimentar
// MVP: CSV Activity Statement (cel mai comun)
```

### Parser Trading 212 — PRIORITATE 2

```typescript
// src/lib/parsers/trading212.ts
// Format: CSV simplu, un singur header, un rând per operațiune

// Columns (2025-2026):
// Action, Time, ISIN, Ticker, Name, No. of shares, Price / share,
// Currency (Price / share), Exchange rate, Result, Currency (Result),
// Total, Currency (Total), Withholding tax, Currency (Withholding tax),
// Charge amount, Notes, ID

// Mapping:
// date = Time (format ISO: "2025-06-15T14:30:00Z")
// type = Action contains "buy" ? 'buy' : Action contains "sell" ? 'sell'
//        Action contains "Dividend" → dividend
// symbol = Ticker
// isin = ISIN
// quantity = parseFloat("No. of shares")
// pricePerUnit = parseFloat("Price / share")
// currency = "Currency (Price / share)"
// exchangeRate = parseFloat("Exchange rate")  // T212 dă cursul!
// commission = 0  // T212 e commission-free (spread inclus în preț)
// whtAmount = parseFloat("Withholding tax")  // pt dividende

// Action values:
// "Market buy", "Market sell", "Limit buy", "Limit sell"
// "Dividend (Ordinary)", "Dividend (Dividend)"
// "Lending interest"  → dobândă din share lending
// "Interest on cash"  → dobândă pe cash

// Country extraction: primele 2 caractere din ISIN (US, IE, GB, DE etc.)
```

### Parser Revolut — PRIORITATE 3

```typescript
// src/lib/parsers/revolut.ts
// Format: CSV simplu din secțiunea Investiții → Statement

// Columns:
// Date, Ticker, Type, Quantity, Price per share, Total Amount,
// Currency, FX Rate

// Mapping:
// date = Date (format: "2025-06-15" sau "15/06/2025")
// type = Type: "BUY" → 'buy', "SELL" → 'sell',
//        "DIVIDEND" → dividend, "CUSTODY_FEE" → ignoră
// symbol = Ticker
// quantity = abs(Quantity)
// pricePerUnit = "Price per share"
// totalAmount = abs("Total Amount")
// currency = Currency
// exchangeRate = parseFloat("FX Rate")
// commission = 0  // Revolut nu listează comision separat

// LIMITARE: Revolut NU separă WHT în CSV → trebuie adăugat manual
// sau estimat din diferența gross vs net pe dividende
// Workaround: afișăm warning + input manual pentru WHT per țară
```

### Parser XTB — PRIORITATE 4

```typescript
// src/lib/parsers/xtb.ts
// Format: Raport tranzacții CSV descărcat din xStation

// Columns (variabile per versiune platformă):
// Symbol, Type, Open time, Close time, Open price, Close price,
// Volume, Commission, Swap, Profit, Comment

// Mapping (pentru CFD-uri și acțiuni):
// date = "Close time" (format: "2025.06.15 14:30:00")
// symbol = Symbol (ex: "AAPL.US_9", "VWCE.DE" — trebuie curățat sufixul)
// type = derivat din Type + Profit (nu e buy/sell explicit pt CFD)
// totalAmount = abs(Profit)  // pt CFD-uri, profitul e deja calculat
// commission = abs(Commission)

// ATENȚIE XTB:
// - XTB România = broker REZIDENT → impozit reținut la sursă
// - XTB (Polonia, fără sediu RO) = broker NEREZIDENT
// - Parser-ul trebuie să permită utilizatorului să specifice
// - CFD-urile vin ca poziții (open/close), nu ca buy/sell individual
// - Dividendele pe acțiuni fracționate vin ca "Dividend" în Comment

// XTB generează și raportul fiscal anual (PDF) → parser PDF opțional pt v2
```

### Parser TradeVille — PRIORITATE 5

```typescript
// src/lib/parsers/tradeville.ts
// Format: CSV/Excel din secțiunea "Istoric tranzacții" sau "Fișa de portofoliu"

// Columns (Istoric tranzacții):
// Data, Simbol, Piata, Sens, Cantitate, Pret, Valoare, Comision, Valuta

// Mapping:
// date = Data (format: "15.06.2025" sau "2025-06-15")
// symbol = Simbol (ex: "SNN", "TLV", "FP")
// type = Sens: "Cumparare"/"C" → 'buy', "Vanzare"/"V" → 'sell'
// quantity = Cantitate
// pricePerUnit = Pret
// totalAmount = Valoare
// commission = Comision
// currency = Valuta (de obicei "RON")
// instrumentType = detectFromMarket(Piata)
//   "REGS" → 'stock', "ATS" → 'bond_corp'/'bond_gov'

// AVANTAJ: TradeVille e broker rezident → impozitul e deja reținut
// Dar parser-ul e util pentru: calcul CASS, comparator broker RO vs străin,
// și pentru utilizatorii care vor să verifice calculele brokerului

// Fișa de portofoliu (PDF) conține deja impozitul calculat — parser PDF pt v2
```

### Flow complet upload → calcul

```
1. Utilizatorul uploadează fișier(e) CSV/XLSX
2. detect.ts citește primele 3 rânduri → identifică broker automat
3. Dacă nu recunoaște → afișează dropdown manual: "Selectează broker"
4. Parser-ul specific transformă → NormalizedTransaction[] + NormalizedDividend[]
5. Afișează preview editabil: tabel cu tranzacții parsate
6. Utilizatorul verifică, corectează, adaugă lipsuri (ex: WHT la Revolut)
7. Click "Calculează" → engine.ts procesează tot → rezultate
8. Warnings vizibile: "3 rânduri nu au putut fi parsate", "WHT lipsă pt 5 dividende"
```

### Edge cases parsare:
- **Corporate actions** (splits, mergers): IBKR le raportează ca tranzacții separate → parser-ul trebuie să le marcheze ca "non-taxable" și să ajusteze baza de cost
- **Fractional shares**: Trading 212 și Revolut permit fracțiuni → quantity poate fi 0.5 acțiuni
- **Multi-currency**: IBKR poate avea tranzacții în USD, EUR, GBP în același cont → fiecare se convertește separat la cursul BNR din ziua tranzacției
- **DRIP** (reinvestire dividende): apare ca "buy" cu notă specială → parser-ul îl tratează ca buy normal, dar dividendul apare separat ca venit impozabil
- **Share lending** (Trading 212): dobânda primită = venit impozabil din alte surse
- **Forex conversions**: IBKR raportează conversii valutare → NU sunt impozabile, se ignoră
- **Duplicate detection**: dacă utilizatorul uploadează 2 fișiere cu perioade suprapuse → detectare duplicat pe (date + symbol + quantity + price)

---

## CERINȚE UX/UI

1. **Dual input**: Upload CSV (killer feature) SAU input manual wizard — utilizatorul alege
2. **Suport multi-broker**: mix broker RO + broker străin în același an, fiecare cu raport separat
3. **Preview editabil**: după upload, utilizatorul vede tabel cu tranzacții și poate corecta
4. **Convertor valutar integrat**: cursuri BNR auto-populate (API bnr.ro cache server-side)
5. **Breakdown vizual**: impozit pe fiecare instrument + CASS separat + total de plată
6. **Export D212**: PDF pre-completat + Ghid SPV personalizat — butoane de descărcare directă
7. **Comparator broker RO vs străin**: arată diferența fiscală pe aceleași tranzacții
8. **Warnings inteligente**: "Nu ai completat WHT", "CASS depășit — trebuie D212", etc.
9. **Salvare progres**: localStorage (sau Supabase pt utilizatori autentificați) — nu pierde datele

## STACK TEHNIC
- **Framework**: Next.js 14+ (App Router) + TypeScript STRICT
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand sau React Context (wizard state machine)
- **Backend**: Supabase (auth + DB pentru saved calculations + storage pentru CSV-uri)
- **Deploy**: Vercel (free tier)
- **CSV Parsing**: Papaparse (client-side, zero server dependency)
- **PDF Generation**: jsPDF + jspdf-autotable (D212) sau @react-pdf/renderer
- **Cursuri BNR**: API route cu cache (ISR 24h) — fetch din bnr.ro/nbrfxrates.xml
- **Charts**: Recharts (breakdown vizual)

## VALIDĂRI OBLIGATORII
- Anul fiscal: 2025 sau 2026 (cote diferite!)
- Broker rezident vs nerezident: SCHIMBĂ COMPLET logica de calcul
- FIFO: ordonare strictă pe simbol + dată achiziție — validare că nu vinzi mai mult decât ai
- Curs BNR: dată exactă pentru tranzacții, mediu anual pentru credit fiscal
- CASS: cumulează TOATE sursele de venit non-salariale, nu doar investiții
- Titluri de stat: ZERO impozit, ZERO CASS — excluse din orice calcul
- Crypto prag: verifică < 200 lei/trx ȘI < 600 lei/an total
- Sell fără buy anterior: eroare + warning "Nu am găsit achiziția pentru această vânzare"
- Sumă negativă imposibilă: commission nu poate fi > valoare tranzacție
- CNP: validare format 13 cifre + check digit (pentru D212 PDF)

## FAZE DE DEZVOLTARE

### MVP (Faza 1 — lansare rapidă)
- Input manual wizard complet
- Motor fiscal complet (Regim A + B + CASS + credit fiscal)
- Export PDF D212 sumar + Ghid SPV
- Parser IBKR (cel mai cerut broker)
- Cursuri BNR integrate
- Landing page + calculator = 1 app

### Faza 2 (post-validare)
- Parser Trading 212 + Revolut
- Supabase auth + salvare calcule
- Comparator broker RO vs străin
- Charts breakdown

### Faza 3 (growth)
- Parser XTB + TradeVille
- Import rapoarte PDF (OCR light)
- Istoric multi-an (pierderi reportate automat)
- Notificări termen D212 (email/push)
