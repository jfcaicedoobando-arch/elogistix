/**
 * Estado interno de useNuevaFacturaProveedorForm (values, errores, TC, refs).
 * Extraído para respetar Power-of-10 (≤200 líneas por archivo).
 */
import { useMemo, useRef, useState } from "react";
import type { VinculosState } from "./useNuevaFacturaProveedorForm.vinculos";
import type { CfdiConceptoParsed } from "@/features/cxp/services";
import type { FacturaFormValues, EmbarqueSeleccionado, TcOrigen } from "@/features/cxp/types";
import type { CargaMode } from "@/features/cxp/components/CargaCfdiSection";
import { type PendingCfdi, initialValues, calcularTotal } from "./useNuevaFacturaProveedorForm.helpers";
import { useTcDofPorFecha } from "./useTcDofPorFecha";
import { useAutoTcEffect } from "./useNuevaFacturaProveedorForm.tcEffect";
import type { FacturaExistentePorUuid } from "./useNuevaFacturaProveedorForm.dup";

export function useFacturaFormState(initialEmbarqueAdHoc?: EmbarqueSeleccionado | null) {
  const [values, setValues] = useState<FacturaFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof FacturaFormValues, string>>>({});
  const [mode, setMode] = useState<CargaMode>("manual");
  const [pendingCfdi, setPendingCfdi] = useState<PendingCfdi | null>(null);
  const [cfdiConceptos, setCfdiConceptos] = useState<CfdiConceptoParsed[]>([]);
  // v13.343.0 — aviso temprano de CFDI ya capturado (índice único por UUID fiscal).
  const [cfdiDuplicado, setCfdiDuplicado] = useState<FacturaExistentePorUuid | null>(null);
  const [askCrearProv, setAskCrearProv] = useState<{ rfc: string; nombre: string } | null>(null);
  const [vinculos, setVinculos] = useState<VinculosState>({});
  const [embarqueAdHoc, setEmbarqueAdHoc] = useState<EmbarqueSeleccionado | null>(
    initialEmbarqueAdHoc ?? null,
  );
  const [tcOrigen, setTcOrigen] = useState<TcOrigen>("vacio");
  const [tcFechaAplicada, setTcFechaAplicada] = useState<string | undefined>();
  const manualTcRef = useRef(false);
  const tcDof = useTcDofPorFecha((r) => {
    setValues((p) => ({ ...p, tc: String(r.tipoCambio) }));
    setTcOrigen("dof");
    setTcFechaAplicada(r.fechaAplicada);
    if (errors.tc) setErrors((e) => ({ ...e, tc: undefined }));
  });
  const total = useMemo(() => calcularTotal(values), [values]);
  const tcDofRef = useRef(tcDof);
  const tcOrigenRef = useRef(tcOrigen);
  tcDofRef.current = tcDof;
  tcOrigenRef.current = tcOrigen;
  useAutoTcEffect(values.moneda, values.emision, tcOrigenRef, tcDofRef);

  return {
    values, setValues, errors, setErrors, mode, setMode,
    pendingCfdi, setPendingCfdi, cfdiConceptos, setCfdiConceptos,
    cfdiDuplicado, setCfdiDuplicado, askCrearProv, setAskCrearProv,
    vinculos, setVinculos, embarqueAdHoc, setEmbarqueAdHoc,
    tcOrigen, setTcOrigen, tcFechaAplicada, setTcFechaAplicada,
    manualTcRef, tcDof, total,
  };
}
