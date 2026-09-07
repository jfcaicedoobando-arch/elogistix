/**
 * Estado y datos derivados del tab de Facturación de un embarque.
 *
 * Extraído de `TabFacturacion.tsx` en v13.336.3 para respetar el límite
 * Power-of-10 de 200 líneas por archivo.
 */
import { useMemo, useState } from "react";
import { useTasaIVA } from "@/features/catalogos/hooks";
import {
  useEmbarqueConceptosVenta,
  useProformasEmbarque,
  useEliminarProforma,
  useDescargarProformaPdf,
  useContenedoresEmbarque,
} from "@/features/embarques/hooks";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import { esBorradorVacio, esBorradorSinConceptos } from "@/features/embarques/components/facturacion/esBorradorVacio";
import { calcularEstadosConceptos } from "@/features/embarques/components/facturacion/estadoConceptoBadge";
import type { FiltroContenedor } from "@/features/embarques/domain/conceptosPorContenedor";
import { esConceptoElegibleProforma } from "@/features/embarques/domain/conceptoElegibleProforma";
import type { Tables } from "@/types/db";

type EmbarqueRow = Tables<"embarques">;

export function useTabFacturacionState(embarque: EmbarqueRow, canEditProp: boolean) {
  const embarqueCerrado = embarque.estado === "Cerrado";
  // v13.823.145 — Un embarque en Borrador todavía no está confirmado: no debe
  // poder generar ni aprobar proformas (antes la UI advertía pero lo permitía).
  const embarqueBorrador = embarque.estado === "Borrador";
  const canEdit = canEditProp && !embarqueCerrado && !embarqueBorrador;
  const tasaIva = useTasaIVA();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialFiltro, setDialogInitialFiltro] = useState<FiltroContenedor>("todos");
  const { data: conceptos = [] } = useEmbarqueConceptosVenta(embarque.id);
  const { data: contenedores = [] } = useContenedoresEmbarque(embarque.id);
  const { data: proformas = [] } = useProformasEmbarque(embarque.id);
  const eliminarProforma = useEliminarProforma();
  const { descargar: descargarProformaPdf } = useDescargarProformaPdf();
  const [proformaAEliminar, setProformaAEliminar] = useState<{ id: string; numero: string } | null>(null);
  const { registerRef } = useFocusSection();

  // Mapa concepto.id → estado tri-valor (pendiente | en_proforma | facturado).
  const estadosConceptos = useMemo(() => calcularEstadosConceptos(conceptos), [conceptos]);

  // R179-02: criterio único de elegibilidad (espejo del candado del RPC):
  // sólo pendientes sin vínculo a proforma. Antes se usaba
  // `estado_facturacion !== "en_proforma"`, que dejaba pasar los facturados y
  // el modal los preseleccionaba.
  const conceptosElegibles = useMemo(
    () => conceptos.filter(esConceptoElegibleProforma),
    [conceptos],
  );
  /** @deprecated Alias de `conceptosElegibles` (mismo conjunto). */
  const conceptosPendientes = conceptosElegibles;
  /** Conceptos verdaderamente huérfanos (sin proforma asignada). */
  const conceptosHuerfanos = conceptosElegibles;

  const borradorVacio = useMemo(
    () => proformas.find((p) => esBorradorVacio(p) || esBorradorSinConceptos(p, conceptos)) ?? null,
    [proformas, conceptos],
  );

  const handleDescargarProforma = async (proformaId: string) => {
    const proforma = proformas.find((p) => p.id === proformaId);
    if (!proforma) return;
    await descargarProformaPdf(proforma, { embarqueOverride: embarque });
  };

  const abrirGenerarProforma = (filtro: FiltroContenedor = "todos") => {
    // Con 0 elegibles no abrimos un modal que sólo podría preseleccionar
    // conceptos ya ocupados (R179-02).
    if (conceptosElegibles.length === 0) return;
    setDialogInitialFiltro(filtro);
    setDialogOpen(true);
  };

  return {
    embarqueCerrado,
    embarqueBorrador,
    canEdit,
    tasaIva,
    conceptos,
    contenedores,
    proformas,
    estadosConceptos,
    conceptosElegibles,
    conceptosPendientes,
    conceptosHuerfanos,
    borradorVacio,
    eliminarProforma,
    proformaAEliminar,
    setProformaAEliminar,
    dialogOpen,
    setDialogOpen,
    dialogInitialFiltro,
    abrirGenerarProforma,
    handleDescargarProforma,
    registerRef,
  };
}
