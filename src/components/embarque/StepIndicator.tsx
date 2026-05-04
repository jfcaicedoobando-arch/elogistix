import { Check } from "lucide-react";

interface Step {
  title: string;
  num: number;
}

interface Props {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: Props) {
  return (
    <div
      className="flex items-center gap-1 sm:gap-2 overflow-x-auto"
      role="list"
      aria-label="Progreso del wizard"
    >
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center flex-1 min-w-fit" role="listitem">
          <div className="flex items-center gap-2">
            <div
              className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                currentStep > step.num ? 'bg-success text-success-foreground' :
                currentStep === step.num ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
              }`}
              aria-current={currentStep === step.num ? 'step' : undefined}
            >
              {currentStep > step.num ? <Check className="h-4 w-4" aria-hidden /> : step.num}
            </div>
            <span className={`text-xs sm:text-sm hidden md:inline whitespace-nowrap ${currentStep === step.num ? 'font-medium' : 'text-muted-foreground'}`}>
              {step.title}
            </span>
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-px mx-2 sm:mx-3 min-w-[12px] ${currentStep > step.num ? 'bg-success' : 'bg-border'}`} />}
        </div>
      ))}
    </div>
  );
}
