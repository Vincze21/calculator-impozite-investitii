'use client';

import { WizardContainer } from '@/components/wizard/WizardContainer';

export default function CalculatorPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="grain-overlay" />
      <WizardContainer />
    </div>
  );
}
