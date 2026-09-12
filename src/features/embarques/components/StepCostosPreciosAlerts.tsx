import { Button } from "@/components/ui/button";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";

interface AlertsProps {
  errors?: StepValidationErrors;
  cargandoCostosVinculados?: boolean;
  errorCostosVinculados?: boolean;
  onReintentarCostos?: () => void;
  showTcWarning?: boolean;
  filasMixtasTotales?: number;
  /** COT-2026-0245: conceptos de costo sin proveedor (informativo, no bloquea). */
  conceptosSinProveedor?: string[];
}

export function StepCostosPreciosAlerts({
  errors = {},
  cargandoCostosVinculados = false,
  errorCostosVinculados = false,
  onReintentarCostos,
  showTcWarning = false,
  filasMixtasTotales = 0,
  conceptosSinProveedor = [],
}: AlertsProps) {
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <>
      {hasErrors && <ValidationAlert severity="error" errors={errors} />}
      {cargandoCostosVinculados && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <AlertTitle>Importando costos de la cotización</AlertTitle>
          <AlertDescription>Espera a que termine antes de crear el embarque.</AlertDescription>
        </Alert>
      )}
      {errorCostosVinculados && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertTitle>No se pudieron importar los costos</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Reintenta para completar la información antes de guardar.</span>
            <Button type="button" variant="outline" size="sm" onClick={onReintentarCostos}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {conceptosSinProveedor.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertTitle>
            {conceptosSinProveedor.length === 1
              ? "1 costo sin proveedor"
              : `${conceptosSinProveedor.length} costos sin proveedor`}
          </AlertTitle>
          <AlertDescription>
            Puedes continuar: el proveedor se asigna después en el expediente.
            Pendientes: {conceptosSinProveedor.join(", ")}.
          </AlertDescription>
        </Alert>
      )}
      {showTcWarning && (
        <ValidationAlert
          severity="warning"
          errors={{ tipoCambio: `Falta tipo de cambio para convertir ${filasMixtasTotales} fila(s) en moneda extranjera. Captura el TC USD/EUR antes de continuar.` }}
        />
      )}
    </>
  );
}
