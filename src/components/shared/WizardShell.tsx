/**
 * `<WizardShell />` — shell compartido para wizards de página completa.
 *
 * Encapsula el layout común que hoy repiten `EmbarqueWizardLayout` y
 * `CotizacionWizardLayout`:
 *  - Header con botón "Volver", título y subtítulo.
 *  - `StepIndicator` clicable (sólo hacia pasos ya visitados).
 *  - Cuerpo scrollable con captura de Enter→siguiente (evita <form> ancestro
 *    por conflicto conocido entre Radix Select y React Hook Form).
 *  - Footer sticky con slot `footer` o el default Anterior/Siguiente/Guardar.
 *
 * Uso mínimo:
 * ```tsx
 * <WizardShell
 *   title="Nueva cotización"
 *   steps={STEPS}
 *   currentStep={step}
 *   onStepClick={setStep}
 *   onBack={goBack}
 *   isBusy={isPending}
 *   defaultFooter={{
 *     onPrev, onNext, onSave, saveLabel: "Guardar cotización",
 *     isLastStep: step === STEPS.length,
 *   }}
 * >
 *   {renderStep()}
 * </WizardShell>
 * ```
 *
 * Para footers custom (p. ej. "Cotizar sin desglose") pasa el prop `footer`.
 */
import { KeyboardEvent, ReactNode, useCallback, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/features/embarques/components/StepIndicator";
import { cn } from "@/lib/utils";

export interface WizardStep {
  num: number;
  title: string;
}

export interface WizardDefaultFooterProps {
  onPrev: () => void;
  onNext: () => void;
  onSave?: () => void;
  saveLabel: string;
  isLastStep: boolean;
  /** Etiqueta del botón izquierdo cuando `currentStep === 1`. Default: "Cancelar". */
  cancelLabel?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  steps: WizardStep[];
  currentStep: number;
  /** Handler para saltar a un paso previo desde el `StepIndicator`. */
  onStepClick?: (step: number) => void;
  /** Botón "Volver" del header. */
  onBack: () => void;
  /** Deshabilita el header (back/step click) y captura de Enter. */
  isBusy?: boolean;
  /** Footer custom. Si se omite, se renderiza `defaultFooter`. */
  footer?: ReactNode;
  defaultFooter?: WizardDefaultFooterProps;
  /** Ancho máximo del contenido; embarques usa 4xl, cotización 6xl. */
  contentMaxWidth?: "4xl" | "6xl";
  children: ReactNode;
}

const MAX_W: Record<NonNullable<Props["contentMaxWidth"]>, string> = {
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
};

export function WizardShell({
  title,
  subtitle,
  steps,
  currentStep,
  onStepClick,
  onBack,
  isBusy = false,
  footer,
  defaultFooter,
  contentMaxWidth = "4xl",
  children,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    if (target.tagName === "BUTTON") return;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "button") return;
    if (target.getAttribute("aria-expanded") === "true") return;
    if (target.tagName !== "INPUT" && target.tagName !== "SELECT") return;
    e.preventDefault();
    if (!isBusy && defaultFooter) defaultFooter.onNext();
  }, [isBusy, defaultFooter]);

  const widthClass = MAX_W[contentMaxWidth];

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] -m-6">
      <div className="flex-none border-b bg-background p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { if (!isBusy) onBack(); }}
            aria-label="Volver"
            disabled={isBusy}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={(s) => { if (!isBusy) onStepClick?.(s); }}
        />
      </div>

      <div onKeyDown={handleKeyDown} className="flex-1 overflow-y-auto p-4" ref={contentRef}>
        <div className={cn(widthClass, "mx-auto space-y-6")}>{children}</div>
      </div>

      <div className="flex-none border-t bg-background p-4">
        <div className={cn(widthClass, "mx-auto flex justify-between gap-2")}>
          {footer ?? (defaultFooter ? <DefaultFooter {...defaultFooter} isBusy={isBusy} /> : null)}
        </div>
      </div>
    </div>
  );
}

function DefaultFooter({
  onPrev,
  onNext,
  onSave,
  saveLabel,
  isLastStep,
  cancelLabel = "Cancelar",
  isBusy,
}: WizardDefaultFooterProps & { isBusy: boolean }) {
  return (
    <>
      <Button variant="outline" onClick={onPrev} disabled={isBusy}>
        {isLastStep || onPrev.name === "onBack" ? (
          cancelLabel
        ) : (
          <>
            <ChevronLeft className="h-4 w-4 mr-1" aria-hidden /> Anterior
          </>
        )}
      </Button>
      <Button disabled={isBusy} onClick={isLastStep ? (onSave ?? onNext) : onNext}>
        {isBusy ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden /> Guardando…
          </>
        ) : isLastStep ? (
          <>
            <Save className="h-4 w-4 mr-1" aria-hidden /> {saveLabel}
          </>
        ) : (
          <>
            Siguiente <ChevronRight className="h-4 w-4 ml-1" aria-hidden />
          </>
        )}
      </Button>
    </>
  );
}
