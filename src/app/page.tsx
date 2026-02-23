import Link from 'next/link';

const FEATURES = [
  {
    title: 'Motor fiscal complet',
    description: 'Calculeaza impozitul pe castiguri de capital (Regim A si B), dividende cu credit fiscal, si CASS pe plafoane fixe.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
    ),
  },
  {
    title: 'Import CSV automat',
    description: 'Uploadeaza raportul CSV de la IBKR, Trading 212, Revolut, TradeVille sau AvaTrade. Detectare automata a brokerului.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    ),
  },
  {
    title: 'Export D212 + Ghid SPV',
    description: 'Genereaza PDF-ul sumar D212 si un ghid pas-cu-pas personalizat pentru completarea in SPV (anaf.ro).',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    ),
  },
  {
    title: 'Cursuri BNR automate',
    description: 'Cursurile zilnice si medii anuale BNR se obtin automat. Conversia valutara corecta conform legislatiei.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    ),
  },
  {
    title: 'Multi-broker',
    description: 'Suport pentru mai multi brokeri simultan: TradeVille, IBKR, Trading 212, Revolut, XTB si altii.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
    ),
  },
  {
    title: 'CASS pe plafoane',
    description: 'Calcul automat CASS: 0 / 2.430 / 4.860 / 9.720 lei in functie de veniturile cumulate non-salariale.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
    ),
  },
];

const RATES_COMPARISON = [
  { label: 'Broker RO (long)', y2025: '1%', y2026: '3%' },
  { label: 'Broker RO (short)', y2025: '3%', y2026: '6%' },
  { label: 'Broker strain', y2025: '10%', y2026: '16%' },
  { label: 'Dividende', y2025: '10%', y2026: '16%' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <div className="grain-overlay" />

      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 py-20 sm:py-32 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium mb-6 animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Actualizat cu cotele 2025-2026
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] animate-fade-up" style={{ animationDelay: '0.1s' }}>
              Calculeaza-ti
              <br />
              <span className="text-primary">impozitele</span>
              <br />
              pe investitii
            </h1>

            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg animate-fade-up" style={{ animationDelay: '0.2s' }}>
              Calculator gratuit pentru investitorii din Romania. Castiguri de capital, dividende, CASS, si generare D212 — totul in cateva minute.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <Link
                href="/calculator"
                className="inline-flex items-center justify-center h-12 px-8 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors gap-2"
              >
                Incepe calculul
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center h-12 px-6 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover:bg-secondary/80 transition-colors"
              >
                Afla mai multe
              </a>
            </div>
          </div>

          {/* Rates comparison card */}
          <div className="mt-12 sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2 sm:mt-0 animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="bg-card/80 backdrop-blur border border-border rounded-xl p-5 max-w-xs shadow-lg">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cote impozit</p>
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 text-xs font-medium text-muted-foreground" />
                    <th className="text-center py-1.5 text-xs font-medium text-muted-foreground w-16">2025</th>
                    <th className="text-center py-1.5 text-xs font-medium text-muted-foreground w-16">2026</th>
                  </tr>
                </thead>
                <tbody>
                  {RATES_COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2 text-xs text-foreground">{row.label}</td>
                      <td className="py-2 text-center font-semibold text-forest-700 whitespace-nowrap">{row.y2025}</td>
                      <td className="py-2 text-center font-semibold text-warm-700 whitespace-nowrap">{row.y2026}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-card">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground mb-12">
            Tot ce ai nevoie pentru declaratia fiscala
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="p-6 bg-background border border-border rounded-xl card-lift"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-12">
            Cum functioneaza
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Introdu datele', desc: 'Alege anul fiscal, brokerii si adauga tranzactiile — manual sau prin import CSV.' },
              { step: '2', title: 'Calculeaza', desc: 'Motorul fiscal aplica FIFO, credit fiscal, compensare pierderi si CASS automat.' },
              { step: '3', title: 'Exporta', desc: 'Descarca PDF-ul D212 sumar si ghidul SPV personalizat, gata de completare.' },
            ].map((item) => (
              <div key={item.step}>
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>

          <Link
            href="/calculator"
            className="inline-flex items-center justify-center h-12 px-8 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors mt-12 gap-2"
          >
            Incepe acum — gratuit
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-card border-t border-border">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Acest instrument are caracter informativ si <strong>NU constituie consultanta fiscala sau juridica</strong>.
              Verifica intotdeauna cu un consultant fiscal autorizat inainte de depunerea declaratiei.
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Bazat pe Codul Fiscal (Legea 227/2015), Legea 141/2025, Legea 239/2025, OUG 78/2025, OUG 89/2025.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
