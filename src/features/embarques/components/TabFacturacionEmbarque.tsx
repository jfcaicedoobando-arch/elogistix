import { FilePlus2, ListChecks, FileText, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DetalleActionBar, type DetalleActionItem } from "@/components/shared/DetalleActionBar";
import { DialogGenerarProforma } from "./DialogGenerarProforma";
import { ResumenConceptosVenta } from "./facturacion/ResumenConceptosVenta";
import { HistorialProformas } from "./facturacion/HistorialProformas";
import { FlujoFacturacionStepper } from "./facturacion/FlujoFacturacionStepper";
import { HistorialFacturas } from "./facturacion/HistorialFacturas";
import { ProformaInconsistenteAlert } from "./facturacion/ProformaInconsistenteAlert";
import { AvisoProformasRechazadas } from "./facturacion/AvisoProformasRechazadas";
import { DialogEliminarProforma } from "./facturacion/DialogEliminarProforma";
import { useTabFacturacionState } from "@/features/embarques/hooks/useTabFacturacionState";
import { contarFacturasEmitidas } from "@/lib/domain/etiquetaCicloProforma";
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

export function TabFacturacionEmbarque({ facturas, canEdit: canEditProp, embarque }: Props) {
  // v13.334.8 — Un embarque Cerrado tiene bloqueada la edición de conceptos a
  // nivel BD (trigger `trg_bloquear_cierre`). Se refleja en la UI para no
  // ofrecer acciones que fallarían con un error técnico.
  const s = useTabFacturacionState(embarque, canEditProp);
  const {
    embarqueCerrado, embarqueBorrador, canEdit, tasaIva, conceptos, contenedores, proformas,
    estadosConceptos, conceptosPendientes, conceptosHuerfanos, borradorVacio,
    eliminarProforma, proformaAEliminar, setProformaAEliminar,
    dialogOpen, setDialogOpen, dialogInitialFiltro, abrirGenerarProforma,
    handleDescargarProforma, registerRef,
  } = s;

  // Barra unificada arriba del tab. Reutiliza `useFocusSection` para saltar
  // a las secciones (Proformas / Facturas) sin duplicar handlers.
  const hayConceptosPendientes = conceptos.some(c => c.estado_facturacion !== 'en_proforma');
  const scrollTo = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-focus="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const actionPrimary: DetalleActionItem | null = hayConceptosPendientes && canEdit
    ? { id: "gen-proforma", label: "Generar proforma", icon: FilePlus2, onClick: () => abrirGenerarProforma() }
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
      {embarqueBorrador && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Embarque en borrador</AlertTitle>
          <AlertDescription>
            Confirma el embarque (pestaña Resumen) para generar o aprobar proformas.
            Mientras esté en borrador sus datos pueden cambiar y la proforma quedaría desalineada.
          </AlertDescription>
        </Alert>
      )}
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
        facturasEmitidasCount={contarFacturasEmitidas(facturas)}
      />
      <div ref={registerRef("venta-pendientes")} data-focus="venta-pendientes">
        <ResumenConceptosVenta
          conceptos={conceptos}
          contenedores={contenedores}
          tasaIva={tasaIva}
          canEdit={canEdit}
          estadosConceptos={estadosConceptos}
          onGenerarProforma={() => abrirGenerarProforma()}
          onGenerarProformaContenedor={(contenedorId) => abrirGenerarProforma(contenedorId)}
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
