import { useState, useMemo } from "react";
import { FilePlus2, ListChecks, FileText } from "lucide-react";
import { DetalleActionBar, type DetalleActionItem } from "@/components/shared/DetalleActionBar";
import { useTasaIVA } from "@/features/catalogos/hooks";
import { useEmbarqueConceptosVenta } from "@/features/embarques/hooks";
import { useProformasEmbarque, useEliminarProforma } from "@/features/embarques/hooks";
import { useDescargarProformaPdf } from "@/features/embarques/hooks";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import { DialogGenerarProforma } from "./DialogGenerarProforma";
import { ResumenConceptosVenta } from "./facturacion/ResumenConceptosVenta";
import { HistorialProformas } from "./facturacion/HistorialProformas";
import { esBorradorVacio, esBorradorSinConceptos } from "./facturacion/esBorradorVacio";
import { calcularEstadosConceptos } from "./facturacion/estadoConceptoBadge";
import { FlujoFacturacionStepper } from "./facturacion/FlujoFacturacionStepper";
import { HistorialFacturas } from "./facturacion/HistorialFacturas";
import { ProformaInconsistenteAlert } from "./facturacion/ProformaInconsistenteAlert";
import { AvisoProformasRechazadas } from "./facturacion/AvisoProformasRechazadas";
import { DialogEliminarProforma } from "./facturacion/DialogEliminarProforma";
import type { FiltroContenedor } from "@/lib/domain/conceptosPorContenedor";
import type { Tables } from "@/types/db";

type EmbarqueRow = Tables<'embarques'>;

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
  fecha_emision: string;
  estado: string;
  proforma_id?: string | null;
  factura_pdf_url?: string | null;
  factura_xml_url?: string | null;
}

interface Props {
  facturas: Factura[];
  canEdit: boolean;
  embarque: EmbarqueRow;
}

export function TabFacturacion({ facturas, canEdit: canEditProp, embarque }: Props) {
  // v13.334.8 — Un embarque Cerrado tiene bloqueada la edición de conceptos a
  // nivel BD (trigger `trg_bloquear_cierre`). Se refleja en la UI para no
  // ofrecer acciones que fallarían con un error técnico.
  const embarqueCerrado = embarque.estado === "Cerrado";
  const canEdit = canEditProp && !embarqueCerrado;
  const tasaIva = useTasaIVA();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialFiltro, setDialogInitialFiltro] = useState<FiltroContenedor>('todos');
  const { data: conceptos = [] } = useEmbarqueConceptosVenta(embarque.id);
  const { data: contenedores = [] } = useContenedoresEmbarque(embarque.id);
  const { data: proformas = [] } = useProformasEmbarque(embarque.id);
  const eliminarProforma = useEliminarProforma();
  const { descargar: descargarProformaPdf } = useDescargarProformaPdf();
  const [proformaAEliminar, setProformaAEliminar] = useState<{ id: string; numero: string } | null>(null);
  const { registerRef } = useFocusSection();

  // Mapa concepto.id → estado tri-valor (pendiente | en_proforma | facturado).
  // Ya se lee directo de `conceptos_venta.estado_facturacion` — el trigger
  // `trg_sync_conceptos_venta_facturado` lo mantiene consistente con
  // `proformas.estado_proforma`.
  const estadosConceptos = useMemo(
    () => calcularEstadosConceptos(conceptos),
    [conceptos]
  );

  const conceptosPendientes = useMemo(
    () => conceptos.filter(c => c.estado_facturacion !== 'en_proforma'),
    [conceptos]
  );

  // Conceptos verdaderamente huérfanos (sin proforma asignada) — usados por la
  // alerta de proforma inconsistente.
  const conceptosHuerfanos = useMemo(
    () => conceptos.filter(c => c.estado_facturacion === 'pendiente' && !c.proforma_id),
    [conceptos]
  );

  const borradorVacio = useMemo(
    () =>
      proformas.find((p) => esBorradorVacio(p) || esBorradorSinConceptos(p, conceptos)) ??
      null,
    [proformas, conceptos],
  );

  const handleDescargarProforma = async (proformaId: string) => {
    const proforma = proformas.find(p => p.id === proformaId);
    if (!proforma) return;
    await descargarProformaPdf(proforma, { embarqueOverride: embarque });
  };

  // Barra unificada arriba del tab. Reutiliza `useFocusSection` para saltar
  // a las secciones (Proformas / Facturas) sin duplicar handlers.
  const hayConceptosPendientes = conceptos.some(c => c.estado_facturacion !== 'en_proforma');
  const abrirGenerarProforma = () => {
    setDialogInitialFiltro('todos');
    setDialogOpen(true);
  };
  const scrollTo = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-focus="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const actionPrimary: DetalleActionItem | null = hayConceptosPendientes && canEdit
    ? { id: "gen-proforma", label: "Generar proforma", icon: FilePlus2, onClick: abrirGenerarProforma }
    : null;
  const actionSecondary: DetalleActionItem[] = [];
  if (proformas.length > 0) {
    actionSecondary.push({
      id: "ver-proformas", label: "Ver proformas", icon: ListChecks,
      onClick: () => scrollTo("proformas"),
    });
  }
  if (facturas.length > 0) {
    actionSecondary.push({
      id: "ver-facturas", label: "Ver facturas", icon: FileText,
      onClick: () => scrollTo("cxc"),
    });
  }

  return (
    <div className="space-y-4">
      {embarqueCerrado && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Embarque cerrado</AlertTitle>
          <AlertDescription>
            La facturación de este embarque está bloqueada. Reabre el embarque desde la
            pestaña Cierre para generar, editar o eliminar proformas.
          </AlertDescription>
        </Alert>
      )}
      <DetalleActionBar primary={actionPrimary} secondary={actionSecondary} />
      <FlujoFacturacionStepper
        conceptosCount={conceptos.length}
        facturadosCount={Array.from(estadosConceptos.values()).filter(e => e === "facturado").length}
        proformasCount={proformas.length}
        proformasFacturadasCount={proformas.filter(p => p.estado_proforma === "facturada").length}
        facturasCount={facturas.length}
      />
      <div ref={registerRef("venta-pendientes")} data-focus="venta-pendientes">
        <ResumenConceptosVenta
          conceptos={conceptos}
          contenedores={contenedores}
          tasaIva={tasaIva}
          canEdit={canEdit}
          estadosConceptos={estadosConceptos}
          onGenerarProforma={() => {
            setDialogInitialFiltro('todos');
            setDialogOpen(true);
          }}
          onGenerarProformaContenedor={(contenedorId) => {
            setDialogInitialFiltro(contenedorId);
            setDialogOpen(true);
          }}
        />
      </div>

      {borradorVacio && (
        <ProformaInconsistenteAlert
          proformaBorrador={borradorVacio}
          conceptosPendientes={conceptosHuerfanos}
          embarqueId={embarque.id}
          onEliminarBorrador={() => setProformaAEliminar({ id: borradorVacio.id, numero: borradorVacio.numero })}
        />
      )}

      <AvisoProformasRechazadas proformas={proformas} />


      <div ref={registerRef("proformas")} data-focus="proformas">
        <HistorialProformas
          proformas={proformas}
          canEdit={canEdit}
          isDeleting={eliminarProforma.isPending}
          onDescargar={handleDescargarProforma}
          onEliminar={(id, numero) => setProformaAEliminar({ id, numero })}
        />
      </div>

      <div ref={registerRef("cxc")} data-focus="cxc">
        <HistorialFacturas facturas={facturas} proformas={proformas} />
      </div>

      <DialogGenerarProforma
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        embarque={embarque}
        conceptosPendientes={conceptosPendientes}
        initialFiltroContenedor={dialogInitialFiltro}
      />

      <DialogEliminarProforma
        proformaAEliminar={proformaAEliminar}
        isPending={eliminarProforma.isPending}
        onCancel={() => setProformaAEliminar(null)}
        onConfirm={async () => {
          if (!proformaAEliminar) return;
          try {
            await eliminarProforma.mutateAsync({
              proformaId: proformaAEliminar.id,
              embarqueId: embarque.id,
              numero: proformaAEliminar.numero,
            });
            setProformaAEliminar(null);
          } catch {
            // Error manejado en hook
          }
        }}
      />
    </div>
  );
}
