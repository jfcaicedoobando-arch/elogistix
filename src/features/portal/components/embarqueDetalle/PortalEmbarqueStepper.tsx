/**
 * Stepper de progreso de embarque.
 * - Desktop (sm+): horizontal con línea de progreso.
 * - Mobile (<sm): vertical con línea izquierda, labels completos legibles.
 */
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import { useIsMobile } from "@/hooks/shared";
import type { ReactNode } from "react";

export interface ProgressStep {
  key: string;
  label: string;
  icon: ReactNode;
}

interface Props {
  progressSteps: ProgressStep[];
  currentStepIndex: number;
  diasParaEta: number | null;
  eta?: string | null;
}

export function PortalEmbarqueStepper({ progressSteps, currentStepIndex, diasParaEta, eta }: Props) {
  const isMobile = useIsMobile();
  const lastIdx = Math.max(0, progressSteps.length - 1);
  const progressPct = Math.min(100, (currentStepIndex / lastIdx) * 100);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        {isMobile ? (
          <ol className="relative space-y-4 pl-2">
            <span aria-hidden className="absolute left-7 top-2 bottom-2 w-0.5 bg-border" />
            <span
              aria-hidden
              className="absolute left-7 top-2 bottom-2 w-0.5 bg-accent origin-top transition-transform duration-500"
              style={{ transform: `scaleY(${lastIdx === 0 ? 0 : currentStepIndex / lastIdx})` }}
            />

            {progressSteps.map((step, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <li key={step.key} className="flex items-center gap-3 relative">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 shrink-0 z-10 transition-all ${
                      isCompleted
                        ? "bg-accent border-accent text-accent-foreground"
                        : isCurrent
                        ? "bg-accent/10 border-accent text-accent ring-4 ring-accent/20"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex items-center justify-between relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
            <div
              className="absolute top-5 left-0 h-0.5 bg-accent transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
            {progressSteps.map((step, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                      isCompleted
                        ? "bg-accent border-accent text-accent-foreground"
                        : isCurrent
                        ? "bg-accent/10 border-accent text-accent ring-4 ring-accent/20"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <span
                    className={`text-[10px] mt-2 text-center font-medium ${
                      isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {diasParaEta !== null && diasParaEta > 0 && (
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Llegada estimada en{" "}
              <span className="font-bold text-accent">
                {diasParaEta} día{diasParaEta !== 1 ? "s" : ""}
              </span>
              {eta && <span> ({formatDate(eta, "dd 'de' MMMM")})</span>}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
