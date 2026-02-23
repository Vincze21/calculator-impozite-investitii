'use client';

import { useCalculatorStore } from '@/hooks/useCalculator';
import { Card, CardContent } from '@/components/ui/card';

export function SPVGuide() {
  const { results } = useCalculatorStore();
  if (!results || !results.d212Required) return null;

  const steps = [
    {
      title: 'Acceseaza SPV',
      detail: 'Mergi la anaf.ro → SPV → Depunere declaratii → Declaratia Unica (D212). Autentificare cu user/parola SPV.',
    },
    {
      title: 'Selecteaza anul fiscal',
      detail: `Alege anul ${results.fiscalYear}. Bifeaza "Declaratie initiala".`,
    },
    {
      title: 'Bifeaza sectiunile necesare',
      detail: 'Bifeaza DOAR sectiunile indicate in preview-ul D212 de mai sus. Nu bifa sectiuni care nu te privesc.',
    },
    {
      title: 'Completeaza datele de identificare',
      detail: 'Nume, Prenume, Initiala tatalui, Adresa completa din CI.',
    },
    {
      title: 'Completeaza veniturile',
      detail: 'Introdu valorile din preview-ul D212 in campurile corespunzatoare (Rd.1, Rd.2, etc.).',
    },
    {
      title: 'Valideaza si depune',
      detail: `Click "Validare" → "Generare PDF" → "Depunere". Salveaza RECIPISA — e dovada depunerii!`,
    },
    {
      title: 'Plateste',
      detail: `Plata pana la ${results.deadline.payment} prin SPV (plata online), ghiseupay.ro, sau transfer bancar. Total: ${Math.round(results.totalDue).toLocaleString('ro-RO')} lei.`,
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-bold text-foreground mb-4">Ghid completare SPV</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Urmeaza acesti pasi pentru a depune Declaratia Unica in SPV (anaf.ro).
      </p>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-0">
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-4 pb-6 last:pb-0 relative">
                {/* Vertical line */}
                {idx < steps.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-border" />
                )}
                {/* Step number */}
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 relative z-10">
                  {idx + 1}
                </div>
                {/* Content */}
                <div className="pt-1">
                  <p className="font-semibold text-sm text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
