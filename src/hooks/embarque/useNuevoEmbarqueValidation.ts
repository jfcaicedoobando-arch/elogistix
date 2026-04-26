/**
 * Sub-hook del wizard "Nuevo Embarque": validación zod por paso.
 * Extraído de `useNuevoEmbarqueWizard` (v8.98.0).
 */
import { useCallback, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import {
  validateStepDatosGenerales,
  validateStepRuta,
  validateStepDocumentos,
  validateStepCostos,
  type StepValidationErrors,
} from "@/lib/domain/embarqueWizardSchemas";
import { notifyError } from "@/lib/ui/appFeedback";

interface UseNuevoEmbarqueValidationParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods: UseFormReturn<any>;
  documentosArchivos: Record<string, File>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conceptosVenta: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conceptosCosto: any[];
}

export function useNuevoEmbarqueValidation({
  methods,
  documentosArchivos,
  conceptosVenta,
  conceptosCosto,
}: UseNuevoEmbarqueValidationParams) {
  const { toast } = useToast();
  const [validationErrors, setValidationErrors] = useState<
    Record<number, StepValidationErrors>
  >({});

  const validateStep = useCallback(
    (step: number): boolean => {
      const values = methods.getValues();
      let errors: StepValidationErrors = {};

      if (step === 1) {
        errors = validateStepDatosGenerales(values);
      } else if (step === 2) {
        errors = validateStepRuta(values);
      } else if (step === 3) {
        const archivos: Record<string, { size: number; type: string }> = {};
        for (const [nombre, file] of Object.entries(documentosArchivos)) {
          archivos[nombre] = { size: file.size, type: file.type };
        }
        errors = validateStepDocumentos(archivos);
      } else if (step === 4) {
        errors = validateStepCostos({
          conceptosVenta: conceptosVenta.map((v) => ({
            id: v.id,
            concepto: v.concepto,
            cantidad: v.cantidad,
            precioUnitario: v.precioUnitario,
            moneda: v.moneda,
          })),
          conceptosCosto: conceptosCosto.map((c) => ({
            id: c.id,
            proveedorId: c.proveedorId,
            concepto: c.concepto,
            monto: c.monto,
            moneda: c.moneda,
          })),
          tipoCambioUSD: values.tipoCambioUSD,
          tipoCambioEUR: values.tipoCambioEUR,
        });
      }

      setValidationErrors((prev) => ({ ...prev, [step]: errors }));

      if (Object.keys(errors).length > 0) {
        notifyError(toast, { step, errors });
        return false;
      }
      return true;
    },
    [methods, documentosArchivos, conceptosVenta, conceptosCosto, toast],
  );

  // Compatibilidad con consumidores antiguos
  const validateStep1 = useCallback(() => validateStep(1), [validateStep]);

  return { validationErrors, validateStep, validateStep1 };
}
