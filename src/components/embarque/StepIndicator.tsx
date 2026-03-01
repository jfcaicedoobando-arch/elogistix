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
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center flex-1">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
              currentStep > step.num ? 'bg-success text-success-foreground' :
              currentStep === step.num ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {currentStep > step.num ? <Check className="h-4 w-4" /> : step.num}
            </div>
            <span className={`text-sm hidden sm:inline ${currentStep === step.num ? 'font-medium' : 'text-muted-foreground'}`}>
              {step.title}
            </span>
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-px mx-3 ${currentStep > step.num ? 'bg-success' : 'bg-border'}`} />}
        </div>
      ))}
    </div>
  );
}
