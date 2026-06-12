/**
 * Controller del <DialogGenerarProforma/>: estado del wizard de 2 pasos
 * (selección → confirmación), totales, IVA por concepto y submit.
 *
 * El submit completo (crear proforma + generar PDF) vive en
 * `submitProformaDialog.ts` para mantener este hook bajo Power-of-10 (≤200 líneas).
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { calcularIVA, resolverTasaConcepto, sumarSubtotales, sumarMontos } from "@/lib/financial/financialUtils";
import { useTasaIVA } from "@/hooks/catalogos/useTasaIVA";
import { useCrearProforma } from "@/features/embarques/hooks/useProformas";
import {
  useDiasCreditoCliente,
  useFetchClienteParaPdf,
} from "@/features/embarques/hooks/useProformaDialog";
import { useContenedoresEmbarque } from "@/features/embarques/hooks/useContenedoresEmbarque";
import {
  filtrarPorContenedor,
  type FiltroContenedor,
} from "@/lib/domain/conceptosPorContenedor";
import { submitProformaDialog } from "./submitProformaDialog";

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
  const [diasCredito, setDiasCredito] = useState<string>("");
  const [filtroContenedor, setFiltroContenedor] = useState<FiltroContenedor>("todos");

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
      const inicial = initialFiltroContenedor === "todos"
        ? conceptosPendientes
        : filtrarPorContenedor(conceptosPendientes, initialFiltroContenedor);
      setSeleccionados(new Set(inicial.map((c) => c.id)));
      const ivaInit: Record<string, boolean> = {};
      conceptosPendientes.forEach((c) => {
        ivaInit[c.id] = c.moneda === "MXN" ? true : !!c.aplica_iva;
      });
      setIvaPorConcepto(ivaInit);
      setNotas("");
      setDiasCredito("");
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

  // Precarga días de crédito del cliente cuando el query se resuelve
  useEffect(() => {
    if (open && diasCreditoDefault != null) {
      setDiasCredito(String(diasCreditoDefault));
    }
  }, [open, diasCreditoDefault]);

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

  const totales = useMemo(() => {
    const usd = conceptosSeleccionados.filter((c) => c.moneda === "USD");
    const mxn = conceptosSeleccionados.filter((c) => c.moneda === "MXN");
    const getter = (c: ConceptoVenta) => ({ cantidad: Number(c.cantidad), precioUnitario: Number(c.precio_unitario) });

    const subtotal_usd = sumarSubtotales(usd, getter);
    const iva_usd = sumarMontos(
      usd.map((c) => (ivaPorConcepto[c.id]
        ? calcularIVA(Number(c.cantidad) * Number(c.precio_unitario), resolverTasaConcepto(c, tasaIva))
        : 0)),
    );
    const total_usd = subtotal_usd + iva_usd;

    const subtotal_mxn = sumarSubtotales(mxn, getter);
    const iva_mxn = sumarMontos(
      mxn.map((c) => calcularIVA(Number(c.cantidad) * Number(c.precio_unitario), resolverTasaConcepto(c, tasaIva))),
    );
    const total_mxn = subtotal_mxn + iva_mxn;

    return { subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn };
  }, [conceptosSeleccionados, tasaIva, ivaPorConcepto]);

  const handleConfirmar = async () => {
    try {
      await submitProformaDialog({
        embarque, conceptosSeleccionados, seleccionados, ivaPorConcepto,
        notas, diasCredito, filtroContenedor, contenedores, totales, tasaIva,
        crearProformaMutateAsync: crearProforma.mutateAsync,
        fetchClienteParaPdfCached,
      });
      onClose();
    } catch {
      // Error manejado en hook
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

