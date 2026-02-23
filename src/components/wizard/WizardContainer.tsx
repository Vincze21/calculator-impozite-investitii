'use client';

import { useCalculatorStore, type WizardStep } from '@/hooks/useCalculator';
import { Step1FiscalYear } from './Step1_FiscalYear';
import { Step2Brokers } from './Step2_Brokers';
import { Step3Import } from './Step3_Import';
import { Step4Transactions } from './Step4_Transactions';
import { Step5Dividends } from './Step5_Dividends';
import { Step6OtherIncome } from './Step6_OtherIncome';
import { Step7Review } from './Step7_Review';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const STEPS: { num: WizardStep; label: string; shortLabel: string }[] = [
  { num: 1, label: 'An fiscal', shortLabel: 'An' },
  { num: 2, label: 'Brokeri', shortLabel: 'Brokeri' },
  { num: 3, label: 'Import date', shortLabel: 'Import' },
  { num: 4, label: 'Tranzactii', shortLabel: 'Tranz.' },
  { num: 5, label: 'Dividende', shortLabel: 'Divid.' },
  { num: 6, label: 'Alte venituri', shortLabel: 'Alte' },
  { num: 7, label: 'Sumar', shortLabel: 'Sumar' },
];

function StepContent({ step }: { step: WizardStep }) {
  switch (step) {
    case 1: return <Step1FiscalYear />;
    case 2: return <Step2Brokers />;
    case 3: return <Step3Import />;
    case 4: return <Step4Transactions />;
    case 5: return <Step5Dividends />;
    case 6: return <Step6OtherIncome />;
    case 7: return <Step7Review />;
  }
}

export function WizardContainer() {
  const { currentStep, setStep, goNext, goBack, reset } = useCalculatorStore();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span className="text-sm font-medium">Acasa</span>
        </Link>
        <button
          onClick={reset}
          className="text-sm text-muted-foreground hover:text-destructive transition-colors"
        >
          Reseteaza tot
        </button>
      </div>

      {/* Stepper */}
      <div className="mb-10">
        <div className="flex items-center justify-between relative">
          {/* Progress line */}
          <div className="absolute top-4 left-0 right-0 h-[2px] bg-border" />
          <div
            className="absolute top-4 left-0 h-[2px] bg-primary transition-all duration-500 ease-out"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map(({ num, label, shortLabel }) => {
            const isActive = num === currentStep;
            const isCompleted = num < currentStep;
            const isClickable = num <= currentStep;

            return (
              <button
                key={num}
                onClick={() => isClickable && setStep(num)}
                disabled={!isClickable}
                className="relative flex flex-col items-center gap-2 z-10"
              >
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300
                    ${isActive ? 'bg-primary text-primary-foreground step-active' : ''}
                    ${isCompleted ? 'bg-primary text-primary-foreground' : ''}
                    ${!isActive && !isCompleted ? 'bg-background border-2 border-border text-muted-foreground' : ''}
                    ${isClickable && !isActive ? 'cursor-pointer hover:border-primary' : ''}
                    ${!isClickable ? 'cursor-default' : ''}
                  `}
                >
                  {isCompleted ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : num}
                </div>
                <span className={`text-xs font-medium transition-colors hidden sm:block ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {label}
                </span>
                <span className={`text-xs font-medium transition-colors sm:hidden ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div key={currentStep} className="animate-fade-up">
        <StepContent step={currentStep} />
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-10 pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Inapoi
        </Button>

        <span className="text-sm text-muted-foreground">
          Pasul {currentStep} din {STEPS.length}
        </span>

        {currentStep < 7 ? (
          <Button onClick={goNext} className="gap-2">
            Continua
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
