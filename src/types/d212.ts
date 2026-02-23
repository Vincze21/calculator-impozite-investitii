export interface UserProfile {
  nume: string;
  prenume: string;
  initialaTata: string;
  strada: string;
  numar: string;
  bloc: string;
  scara: string;
  etaj: string;
  apartament: string;
  judet: string;
  localitate: string;
  codPostal: string;
  telefon: string;
  email: string;
  iban: string;
}

export interface D212Section1Row {
  category: '1.5' | '1.6' | '1.7.3';
  categoryDescription: string;
  venitBrut: number;
  cheltuieliDeductibile: number;
  venitNet: number;
  pierdereFiscala: number;
  pierderiReportate: number;
  pierdereCompensata: number;
  castigImpozabil: number;
  impozitDatorat: number;
}

export interface D212Section2Row {
  country: string;
  countryName: string;
  incomeCategory: 'dividende' | 'castiguri_capital' | 'dobanzi';
  venitBrut: number;
  cheltuieliDeductibile: number;
  venitNet: number;
  venitImpozabil: number;
  impozitDatoratRO: number;
  impozitPlatitStrainatate: number;
  creditFiscal: number;
  diferentaPlata: number;
}

export interface D212Section3 {
  bazaCalcul: number;
  cassDatorata: number;
}

export interface D212Section7 {
  totalImpozitVenit: number;
  totalCASS: number;
  totalDePlata: number;
  termenPlata: string;
}

export interface D212Data {
  fiscalYear: number;
  userProfile: UserProfile;
  checkedSections: string[];
  section1: D212Section1Row[];
  section2: D212Section2Row[];
  section3: D212Section3 | null;
  section7: D212Section7;
}

export interface SPVStep {
  step: number;
  title: string;
  action: string;
  note?: string;
  fields?: Record<string, string>;
  substeps?: { category: string; fields: Record<string, string> }[];
  condition?: string;
}
