/**
 * Controller del <DialogGenerarProforma/>: estado del wizard de 2 pasos
 * (selección → confirmación), totales, IVA por concepto y submit.
 */
import { useState, useMemo, useEffect } from "react";
import { calcularIVA } from "@/lib/financial/financialUtils";
import { useTasaIVA } from "@/hooks/catalogos/useTasaIVA";
import { useCrearProforma } from "@/hooks/embarque/useProformas";
import {
  useDiasCreditoCliente,
  useFetchClienteParaPdf,
} from "@/hooks/embarque/useProformaDialog";
import { useContenedoresEmbarque } from "@/hooks/embarque/useContenedoresEmbarque";
import {
  filtrarPorContenedor,
  type FiltroContenedor,
} from "@/lib/domain/conceptosPorContenedor";

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

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setPaso("seleccion");
      setFiltroContenedor(initialFiltroContenedor);
      // v12.14.0: cuando se abre filtrado a un contenedor concreto, preseleccionar
      // sólo los conceptos de ese filtro (evita facturar de más al encadenar
      // proformas por contenedor). En modo 'todos' se mantiene la selección
      // completa de pendientes.
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
    }
  }, [open, conceptosPendientes, initialFiltroContenedor]);

  // Cuando cambia el filtro, ajustar selección al conjunto visible
  useEffect(() => {
    if (!open) return;
    const visibleIds = new Set(conceptosVisibles.map((c) => c.id));
    setSeleccionados((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => { if (visibleIds.has(id)) next.add(id); });
      // Si la selección quedó vacía, pre-seleccionar todos los visibles
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
    if (allVisibleSelected) {
      setSeleccionados((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSeleccionados((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
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

    const subtotal_usd = usd.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
    const iva_usd = usd.reduce((s, c) => {
      const sub = Number(c.cantidad) * Number(c.precio_unitario);
      return ivaPorConcepto[c.id] ? s + calcularIVA(sub, tasaIva) : s;
    }, 0);
    const total_usd = subtotal_usd + iva_usd;

    const subtotal_mxn = mxn.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
    const iva_mxn = calcularIVA(subtotal_mxn, tasaIva);
    const total_mxn = subtotal_mxn + iva_mxn;

    return { subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn };
  }, [conceptosSeleccionados, tasaIva, ivaPorConcepto]);

  const handleConfirmar = async () => {
    try {
      const ivaOverrides: Record<string, boolean> = {};
      conceptosSeleccionados.forEach((c) => {
        ivaOverrides[c.id] = c.moneda === "MXN" ? true : !!ivaPorConcepto[c.id];
      });

      // Prefijo en notas si la proforma está acotada a un contenedor
      let notasFinal = notas.trim() || null;
      if (filtroContenedor !== "todos" && filtroContenedor !== "generales") {
        const cont = contenedores.find((c) => c.id === filtroContenedor);
        if (cont) {
          const etiqueta = `Proforma del contenedor ${cont.numero_contenedor || `#${cont.orden}`}`;
          notasFinal = notasFinal ? `${etiqueta}\n${notasFinal}` : etiqueta;
        }
      } else if (filtroContenedor === "generales") {
        const etiqueta = "Proforma de conceptos generales del embarque";
        notasFinal = notasFinal ? `${etiqueta}\n${notasFinal}` : etiqueta;
      }

      const diasCreditoNum = diasCredito.trim() === "" ? null : Number(diasCredito);
      const proforma = await crearProforma.mutateAsync({
        embarqueId: embarque.id,
        clienteId: embarque.cliente_id,
        clienteNombre: embarque.cliente_nombre,
        expediente: embarque.expediente,
        blMaster: embarque.bl_master,
        conceptoIds: Array.from(seleccionados),
        totales,
        notas: notasFinal,
        operador: embarque.operador || null,
        diasCredito: Number.isFinite(diasCreditoNum as number) ? (diasCreditoNum as number) : null,
        tasaIva,
        ivaOverrides,
      });
      const cliente = await fetchClienteParaPdfCached(embarque.cliente_id);
      const conceptosParaPdf = conceptosSeleccionados.map((c) => ({
        ...c,
        aplica_iva: ivaOverrides[c.id],
      }));
      const { generarPdfProforma } = await import("@/generators/proformaPdf");
      await generarPdfProforma({
        proforma,
        embarque,
        conceptos: conceptosParaPdf,
        cliente,
        tasaIva,
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
