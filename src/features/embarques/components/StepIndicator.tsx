import { Check } from "lucide-react";
import { getStepIndicatorCircleClass } from "@/lib/ui/uiMappings";

interface Step {
  title: string;
  num: number;
}

interface Props {
  steps: Step[];
  currentStep: number;
  /**
   * Callback opcional para saltar a un paso ya visitado (paso ≤ currentStep).
   * Cuando se provee, cada paso se vuelve `<button>` navegable con teclado.
   */
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepClick }: Props) {
  return (
    <ol
      className="flex items-center gap-1 sm:gap-2 overflow-x-auto list-none p-0 m-0"
      aria-label="Progreso del wizard"
    >
      {steps.map((step, i) => {
        const isCompleted = currentStep > step.num;
        const isCurrent = currentStep === step.num;
        const canJump = !!onStepClick && step.num < currentStep;
        const circleClass = `h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getStepIndicatorCircleClass(currentStep, step.num)}`;
        const labelClass = `text-xs sm:text-sm hidden md:inline whitespace-nowrap ${isCurrent ? 'font-medium' : 'text-muted-foreground'}`;

        const content = (
          <>
            <span
              className={circleClass}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCompleted ? <Check className="h-4 w-4" aria-hidden /> : step.num}
            </span>
            <span className={labelClass}>{step.title}</span>
          </>
        );

        return (
          <li key={step.num} className="flex items-center flex-1 min-w-fit">
            {canJump ? (
              <button
                type="button"
                onClick={() => onStepClick?.(step.num)}
                className="flex items-center gap-2 rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-80"
                aria-label={`Ir al paso ${step.num}: ${step.title}`}
              >
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-2" aria-label={isCurrent ? `Paso actual ${step.num}: ${step.title}` : undefined}>
                {content}
              </div>
            )}
            {i < steps.length - 1 && <div className={`flex-1 h-px mx-2 sm:mx-3 min-w-[12px] ${isCompleted ? 'bg-success' : 'bg-border'}`} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
