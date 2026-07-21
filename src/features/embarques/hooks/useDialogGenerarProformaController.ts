/**
 * Controller del <DialogGenerarProforma/>: estado del wizard de 2 pasos
 * (selección → confirmación), totales, IVA por concepto y submit.
 *
 * El submit completo (crear proforma + generar PDF) vive en
 * `submitProformaDialog.ts` para mantener este hook bajo Power-of-10 (≤200 líneas).
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { useCrearProforma } from "@/features/embarques/hooks/useProformas";
import {
  useDiasCreditoCliente,
  useFetchClienteParaPdf,
} from "@/features/embarques/hooks/useProformaDialog";
import { useContenedoresEmbarque } from "@/features/embarques/hooks/useContenedoresEmbarque";
import {
  filtrarPorContenedor,
  type FiltroContenedor,
} from "@/features/cotizacion/domain/conceptosPorContenedor";
import { submitProformaDialog, ProformaValidationError } from "@/features/embarques/services/submitProformaDialog";
import { toast } from "@/hooks/shared";
import {
  calcularTotalesProforma,
  buildInitialProformaState,
} from "./useDialogGenerarProformaController.helpers";

import type { Tables } from "@/integrations/supabase/types";

type ConceptoVenta = Tables<"conceptos_venta">;
type EmbarqueRow = Tables<"embarques">;

export type PasoProformaDialog = "seleccion" | "confirmacion";

export function useDialogGenerarProformaController(
  open: boolean,
  embarque: EmbarqueRow,
  conceptosPendientes: ConceptoVenta[],
  onClose: () => void,
  initialFiltroContenedor: FiltroContenedor = "todos",
) {
  const tasaIva = useTasaIVA();
  const crearProforma = useCrearProforma();
  const fetchClienteParaPdfCached = useFetchClienteParaPdf();
  const { data: diasCreditoDefault } = useDiasCreditoCliente(embarque.cliente_id, open);
  const { data: contenedores = [] } = useContenedoresEmbarque(embarque.id);

  const [paso, setPaso] = useState<PasoProformaDialog>("seleccion");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [ivaPorConcepto, setIvaPorConcepto] = useState<Record<string, boolean>>({});
  const [notas, setNotas] = useState("");
  const [filtroContenedor, setFiltroContenedor] = useState<FiltroContenedor>("todos");

  // v13.303.80: diasCredito y operador NO son editables en el modal — provienen
  // de la fuente única de verdad (clientes.dias_credito / embarques.operador).
  const diasCredito = diasCreditoDefault != null ? String(diasCreditoDefault) : "";

  // Conceptos visibles según el filtro de contenedor
  const conceptosVisibles = useMemo(
    () => filtrarPorContenedor(conceptosPendientes, filtroContenedor),
    [conceptosPendientes, filtroContenedor],
  );

  // Fix v12.94.2: solo reinicializar el state al pasar de cerrado→abierto.
  // Antes este efecto dependía de `conceptosPendientes`, y un refetch de React
  // Query durante el diálogo borraba los toggles de IVA del usuario provocando
  // proformas con IVA en cero pese a estar marcado en pantalla.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setPaso("seleccion");
      setFiltroContenedor(initialFiltroContenedor);
      const init = buildInitialProformaState(conceptosPendientes, initialFiltroContenedor);
      setSeleccionados(init.seleccionados);
      setIvaPorConcepto(init.ivaPorConcepto);
      setNotas("");
    } else if (!open && wasOpenRef.current) {
      wasOpenRef.current = false;
    }
  }, [open, conceptosPendientes, initialFiltroContenedor]);

  // Cuando cambia el filtro, ajustar selección al conjunto visible
  useEffect(() => {
    if (!open) return;
    const visibleIds = new Set(conceptosVisibles.map((c) => c.id));
    setSeleccionados((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => { if (visibleIds.has(id)) next.add(id); });
      if (next.size === 0) visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, [open, filtroContenedor, conceptosVisibles]);


  const toggle = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const visibleIds = conceptosVisibles.map((c) => c.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => seleccionados.has(id));
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleIva = (id: string, moneda: string) => {
    if (moneda === "MXN") return;
    setIvaPorConcepto((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const conceptosSeleccionados = useMemo(
    () => conceptosPendientes.filter((c) => seleccionados.has(c.id)),
    [conceptosPendientes, seleccionados],
  );

  const totales = useMemo(
    () => calcularTotalesProforma(conceptosSeleccionados, ivaPorConcepto, tasaIva),
    [conceptosSeleccionados, tasaIva, ivaPorConcepto],
  );

  const handleConfirmar = async () => {
    try {
      await submitProformaDialog({
        embarque, conceptosSeleccionados, seleccionados, ivaPorConcepto,
        notas, diasCredito, filtroContenedor, contenedores, totales, tasaIva,
        crearProformaMutateAsync: crearProforma.mutateAsync,
        fetchClienteParaPdfCached,
      });
      onClose();
    } catch (err) {
      // Errores del RPC `crearProforma` ya muestran toast vía onError del hook;
      // este catch maneja validación FCL previa y fallos del PDF/cliente, que
      // antes se silenciaban (botón "no hacía nada"). 13.67.9.
      const message =
        err instanceof Error ? err.message : "No se pudo generar la proforma. Intenta de nuevo.";
      const isValidation = err instanceof ProformaValidationError;
      const isMutationError = !isValidation
        && typeof err === "object" && err !== null
        && "name" in err && (err as { name?: string }).name === "PostgrestError";
      // El hook crearProforma ya toasteó este caso, evitamos duplicar.
      if (!isMutationError) {
        toast({ title: message, variant: isValidation ? "warning" : "destructive" });
      }
      if (!isValidation && !isMutationError) {
        void import("@sentry/react").then(({ captureException }) =>
          captureException(err, { tags: { feature: "proforma_generate" } }),
        ).catch(() => undefined);
      }
    }
  };

  return {
    paso, setPaso,
    seleccionados, ivaPorConcepto, notas, diasCredito,
    setNotas, setDiasCredito,
    toggle, toggleAll, toggleIva,
    conceptosSeleccionados,
    conceptosVisibles,
    contenedores,
    filtroContenedor, setFiltroContenedor,
    totales, tasaIva,
    handleConfirmar,
    isPending: crearProforma.isPending,
    totalSeleccionados: seleccionados.size,
  };
}

