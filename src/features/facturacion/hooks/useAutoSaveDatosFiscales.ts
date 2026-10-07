/**
 * Autosave del borrador: debounce cancelable antes de enviar, destino capturado
 * y cola serial por factura/empresa. Nunca guarda desde el cleanup ni simula
 * abortar una escritura ya enviada. Las pestañas editables conservan este estado.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { notifyError } from "@/lib/ui/appFeedback";
import { actualizarDatosTimbradoFactura, type DatosTimbradoPatch } from "@/features/facturacion/services";
import { useReconciliarAutoSave } from "./useReconciliarAutoSave";
import { encolarAutoSave } from "./colaAutoSaveDatosFiscales";
import type { FacturaDetalle } from "../services/detail";
import { buildDatosTimbradoPatch, type DatosFiscalesEstado } from "@/features/facturacion/domain/datosFiscalesForm";

export type AutoSaveEstado = "idle" | "saving" | "saved" | "error";
const DEBOUNCE_MS = 500;
interface Captura { facturaId: string; organizationId: string; patch: Partial<DatosTimbradoPatch>; revision: number; signal: AbortSignal; authScope: ReturnType<typeof captureAuthOperationScope> }

/** Cancelar el debounce no significa abortar una escritura que ya salió. */
function esperarDebounce(signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(false); return; }
    const cancelar = () => { clearTimeout(timer); resolve(false); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancelar); resolve(true); }, DEBOUNCE_MS);
    signal.addEventListener("abort", cancelar, { once: true });
  });
}

export function useAutoSaveDatosFiscales(facturaId: string, moneda: string, values: DatosFiscalesEstado, organizationId: string, camposEditados?: readonly (keyof DatosTimbradoPatch)[]) {
  const qc = useQueryClient();
  // El formulario pertenece a esta sesión. No recapturar al ejecutar una cola
  // antigua ni permitir que otro usuario herede los campos sin reabrirlo.
  const [authScope] = useState(captureAuthOperationScope);
  const [estado, setEstado] = useState<AutoSaveEstado>("idle");
  const [ultimoGuardado, setUltimoGuardado] = useState<number | null>(null);
  const montado = useRef(false);
  const revision = useRef(0);
  const capturaActual = useRef<Captura | null>(null);
  const destino = `${organizationId}:${facturaId}`;
  const destinoAnterior = useRef(destino);
  const { usoCfdi, formaPago, metodoPago, diasCredito, tipoCambio, notas } = values;
  const candidato = useMemo(() => {
    const todos = buildDatosTimbradoPatch({ usoCfdi, formaPago, metodoPago, diasCredito, tipoCambio, notas }, moneda);
    return camposEditados ? Object.fromEntries(Object.entries(todos).filter(([key]) => camposEditados.includes(key as keyof DatosTimbradoPatch))) as Partial<DatosTimbradoPatch> : todos;
  }, [usoCfdi, formaPago, metodoPago, diasCredito, tipoCambio, notas, moneda, camposEditados]);
  // Normalizar notas/enteros puede producir el mismo patch. Estabilizar ANTES
  // de la dependencia evita abortar el timer por un cambio que no requiere otro.
  const patchJson = JSON.stringify(candidato);
  const patch = useMemo(() => JSON.parse(patchJson) as Partial<DatosTimbradoPatch>, [patchJson]);
  const anterior = useRef(patch);
  const reconciliacion = useReconciliarAutoSave(qc, facturaId, organizationId, authScope);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; revision.current += 1; };
  }, []);

  const { mutate } = useMutation({
    mutationKey: queryKeys.facturacion.autosaveDatosTimbrado(facturaId, organizationId),
    // La cola es efímera; no usar scope/pausa offline que el persister pueda rehidratar.
    networkMode: "always",
    retry: false,
    gcTime: 0,
    mutationFn: async (v: Captura) => {
      if (!(await esperarDebounce(v.signal)) || v.signal.aborted) return false;
      return encolarAutoSave(qc, `${v.organizationId}:${v.facturaId}`, async () => {
        if (v.signal.aborted) return false;
        v.authScope.assertCurrent();
        await actualizarDatosTimbradoFactura(v.facturaId, v.patch, undefined, { organizationId: v.organizationId, borrador: true, authScope: v.authScope });
        return true;
      });
    },
    onSuccess: async (guardado, v) => {
      if (!guardado || !v.authScope.isCurrent()) return;
      // Una respuesta confirma sólo su destino. Nunca sobreescribir un CFDI ya emitido en caché.
      const key = queryKeys.facturas.detail(v.facturaId);
      qc.setQueryData<FacturaDetalle | null>(key, (cached) => esBorradorDestino(cached, v) ? { ...cached, ...v.patch } : cached);
      await qc.invalidateQueries({ queryKey: key });
      if (!v.authScope.isCurrent() || !montado.current || revision.current !== v.revision) return;
      setEstado("saved");
      setUltimoGuardado(Date.now());
    },
    onError: (error, v) => {
      if (!v.authScope.isCurrent()) return;
      if (montado.current && revision.current === v.revision) setEstado("error");
      notifyError(undefined, { title: "No se pudieron guardar los datos fiscales", error,
        method: "FACTURA_DATOS_FISCALES_AUTOSAVE", context: { facturaId: v.facturaId, organizationId: v.organizationId } });
    },
  });

  useEffect(() => {
    // Un consumidor que cambia destino sin key tampoco puede copiarle la captura anterior.
    if (destinoAnterior.current !== destino) {
      destinoAnterior.current = destino; anterior.current = patch; revision.current += 1;
      setEstado("idle"); setUltimoGuardado(null); return;
    }
    // Incluye el doble montaje de efectos en StrictMode: hidratar no es editar.
    if (anterior.current === patch) return;
    anterior.current = patch;
    const version = ++revision.current;
    setEstado("saving");
    const ctrl = new AbortController();
    capturaActual.current = { facturaId, organizationId, patch, revision: version, signal: ctrl.signal, authScope };
    mutate(capturaActual.current);
    return () => ctrl.abort();
  }, [destino, facturaId, organizationId, patch, mutate, authScope]);

  const reintentar = () => {
    if (reconciliacion.isError) return reconciliacion.reintentar();
    const captura = capturaActual.current;
    if (estado !== "error" || !captura || captura.signal.aborted || !captura.authScope.isCurrent()) return;
    if (qc.isMutating({ mutationKey: queryKeys.facturacion.autosaveDatosTimbrado(facturaId, organizationId) })) return;
    setEstado("saving");
    mutate(captura);
  };
  const estadoVisible = reconciliacion.isPending ? "saving" : reconciliacion.isError ? "error" : estado;
  return { estado: estadoVisible, ultimoGuardado, reintentar };
}

function esBorradorDestino(cached: FacturaDetalle | null | undefined, v: Captura): cached is FacturaDetalle {
  return !!cached && cached.id === v.facturaId && cached.organization_id === v.organizationId
    && !cached.uuid_fiscal && !cached.facturapi_id && ["Borrador", "Por timbrar"].includes(cached.estado);
}
