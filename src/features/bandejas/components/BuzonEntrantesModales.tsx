/**
 * v13.510.1 — Modales y vista previa del buzón CxP, extraídos de la ruta para
 * respetar el límite de 200 líneas por archivo (Power of 10).
 */
import { PreviaFacturaEntranteSheet } from "./PreviaFacturaEntranteSheet";
import { MarcarCapturadaDialog } from "./MarcarCapturadaDialog";
import { RechazarFacturaEntranteDialog } from "./RechazarFacturaEntranteDialog";
import { DialogNuevaFacturaProveedor } from "@/features/cxp";
import { CorregirDatosEntranteDialog } from "@/features/embarques/components/entrantes/CorregirDatosEntranteDialog";
import type { FacturaEntranteRow } from "@/features/cxp/services";
import type { EntranteParaCaptura } from "@/features/cxp/types";

interface AccionesFila {
  onVerXml: (row: FacturaEntranteRow) => void;
  onCapturar: (row: FacturaEntranteRow) => void;
  onCrearFactura: (row: FacturaEntranteRow) => void;
  onRechazar: (row: FacturaEntranteRow) => void;
}

interface Props {
  puedeProcesar: boolean;
  acciones: AccionesFila;
  enPrevia: FacturaEntranteRow | null;
  onCerrarPrevia: () => void;
  aCapturar: FacturaEntranteRow | null;
  onCerrarCapturar: () => void;
  capturarPendiente: boolean;
  onConfirmarCapturada: (facturaId: string) => Promise<void>;
  aRechazar: FacturaEntranteRow | null;
  onCerrarRechazar: () => void;
  rechazarPendiente: boolean;
  onConfirmarRechazo: (motivo: string) => Promise<void>;
  entranteCaptura: EntranteParaCaptura | null;
  onCerrarCaptura: () => void;
  /** v13.618.0 — Documento en corrección (importe faltante, proveedor, conceptos). */
  aCorregir?: FacturaEntranteRow | null;
  onCerrarCorregir?: () => void;
}

export function BuzonEntrantesModales({
  puedeProcesar, acciones, enPrevia, onCerrarPrevia, aCapturar, onCerrarCapturar,
  capturarPendiente, onConfirmarCapturada, aRechazar, onCerrarRechazar,
  rechazarPendiente, onConfirmarRechazo, entranteCaptura, onCerrarCaptura,
  aCorregir = null, onCerrarCorregir,
}: Props) {
  return (
    <>
      <PreviaFacturaEntranteSheet
        row={enPrevia}
        onOpenChange={(v) => { if (!v) onCerrarPrevia(); }}
        puedeProcesar={puedeProcesar}
        onVerXml={acciones.onVerXml}
        onCapturar={acciones.onCapturar}
        onCrearFactura={acciones.onCrearFactura}
        onRechazar={acciones.onRechazar}
      />

      <MarcarCapturadaDialog
        open={Boolean(aCapturar)}
        onOpenChange={(v) => { if (!v) onCerrarCapturar(); }}
        embarqueId={aCapturar?.embarque_id ?? null}
        expediente={aCapturar?.embarques?.expediente ?? null}
        nombreArchivo={aCapturar?.nombre_archivo ?? null}
        pendiente={capturarPendiente}
        onConfirm={onConfirmarCapturada}
      />

      <DialogNuevaFacturaProveedor
        open={Boolean(entranteCaptura)}
        onOpenChange={(v) => { if (!v) onCerrarCaptura(); }}
        entrante={entranteCaptura}
        onCapturada={onCerrarCaptura}
      />

      <RechazarFacturaEntranteDialog
        open={Boolean(aRechazar)}
        onOpenChange={(v) => { if (!v) onCerrarRechazar(); }}
        pendiente={rechazarPendiente}
        onConfirm={onConfirmarRechazo}
      />

      <CorregirDatosEntranteDialog
        row={aCorregir}
        onOpenChange={(v) => { if (!v) onCerrarCorregir?.(); }}
      />
    </>
  );
}
