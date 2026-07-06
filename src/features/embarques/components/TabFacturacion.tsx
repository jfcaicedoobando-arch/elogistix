import { useState, useMemo } from "react";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import type { FiltroContenedor } from "@/features/cotizacion/domain/conceptosPorContenedor";
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

export function TabFacturacion({ facturas, canEdit, embarque }: Props) {
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
  // El estado "facturado" se deriva cruzando con `proformas.estado_proforma`
  // porque `conceptos_venta.estado_facturacion` es binario en BD.
  const estadosConceptos = useMemo(
    () => calcularEstadosConceptos(conceptos, proformas),
    [conceptos, proformas]
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

  return (
    <div className="space-y-4">
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


      <HistorialProformas
        proformas={proformas}
        canEdit={canEdit}
        isDeleting={eliminarProforma.isPending}
        onDescargar={handleDescargarProforma}
        onEliminar={(id, numero) => setProformaAEliminar({ id, numero })}
      />

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

      <AlertDialog open={!!proformaAEliminar} onOpenChange={(o) => !o && setProformaAEliminar(null)}>
        <AlertDialogContent className={dialogSize.sm}>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proforma</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar la proforma <strong>{proformaAEliminar?.numero}</strong>? Los conceptos volverán a estado Pendiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminarProforma.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={eliminarProforma.isPending}
              onClick={async (e) => {
                e.preventDefault();
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {eliminarProforma.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                <>Eliminar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
