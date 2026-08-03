/**
 * Captura de factura de proveedor: manual, por XML CFDI, por PDF con IA o
 * desde el buzón CxP (v13.366.0).
 * v13.400.0 — Optimizado para HD: ancho 4xl, dos columnas desde `lg`, KPIs de
 * totales fijos arriba y semáforo de cuadre fijo sobre el footer.
 */
import { useNavigate } from "react-router-dom";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import { usePermissions } from "@/hooks/shared";
import { DialogFacturaProveedorSinPermiso } from "@/features/cxp/components/DialogFacturaProveedorSinPermiso";
import { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import { CrearProveedorDesdeCfdiDialog } from "./CrearProveedorDesdeCfdiDialog";
import { CuadreConceptosBar } from "./CuadreConceptosBar";
import { FacturaProveedorTotalesKpis } from "./FacturaProveedorTotalesKpis";
import { ColumnaDocumento, ColumnaDatosFactura } from "./DialogNuevaFacturaProveedor.columnas";
import { useCuadreCaptura } from "@/features/cxp/hooks/useCuadreCaptura";
import { useAutocargaEntrante } from "@/features/cxp/hooks/useAutocargaEntrante";
import { useCapturaEntranteWiring } from "@/features/cxp/hooks/useCapturaEntranteWiring";
import type { EmbarqueSeleccionado, EntranteParaCaptura } from "@/features/cxp/types";


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialEmbarqueAdHoc?: EmbarqueSeleccionado | null;
  /** v13.366.0 — Captura desde el buzón CxP: precarga y marca el documento. */
  entrante?: EntranteParaCaptura | null;
  onCapturada?: () => void;
}

/**
 * R-05.2: puerta de permisos. Sin capacidad de captura mostramos el motivo en
 * vez de un formulario que la base de datos rechazará al guardar.
 */
export function DialogNuevaFacturaProveedor(props: Props) {
  const { canCapturarFacturaProveedor } = usePermissions();
  if (!canCapturarFacturaProveedor) {
    return <DialogFacturaProveedorSinPermiso open={props.open} onOpenChange={props.onOpenChange} />;
  }
  return <DialogNuevaFacturaProveedorForm {...props} />;
}

function DialogNuevaFacturaProveedorForm({
  open, onOpenChange, initialEmbarqueAdHoc, entrante, onCapturada,
}: Props) {
  const navigate = useNavigate();
  const cats = usePresupuestoCategorias(true);
  const wiring = useCapturaEntranteWiring({
    entrante, initialEmbarqueAdHoc, onCapturada,
    onCerrar: () => onOpenChange(false),
  });
  const ctl = useNuevaFacturaProveedorForm(wiring.onDone, wiring.embarqueInicial);
  const autocarga = useAutocargaEntrante({
    entrante, abierto: open, categorias: cats.data ?? [],
    onCfdiParsed: ctl.handleCfdiParsed, onPdfParsed: ctl.handlePdfIaParsed,
  });

  const sub = Number(ctl.values.subtotal) || 0;
  const iva = Number(ctl.values.iva) || 0;
  const ieps = Number(ctl.values.ieps) || 0;
  const ret = Number(ctl.values.retenciones) || 0;
  const moneda = ctl.values.moneda;

  const { conceptosParaCuadre, cuadre, keyRenglonSospechoso } = useCuadreCaptura({
    subtotal: sub,
    cfdiConceptos: ctl.cfdiConceptos,
    conceptosManuales: ctl.conceptosManuales.conceptos,
    vinculos: ctl.vinculos,
  });



  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ctl.isPending}>
        Cancelar
      </Button>
      <Button onClick={ctl.submit} disabled={!ctl.puedeGuardar}>
        {ctl.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {ctl.isPending ? "Guardando…" : "Guardar factura"}
      </Button>
    </>
  );

  return (
    <>
      <FormDialogShell
        open={open}
        onOpenChange={(o) => { if (!o) ctl.reset(); onOpenChange(o); }}
        icon={FileSpreadsheet}
        title="Capturar factura de proveedor"
        description="Registra la factura recibida. Si es de un proveedor mexicano, sube el XML CFDI y se prellenará automáticamente."
        size="4xl"
        footer={footer}
        stickyTop={
          <FacturaProveedorTotalesKpis
            subtotal={sub} iva={iva} ieps={ieps} retenciones={ret}
            total={ctl.total} moneda={moneda}
          />
        }
        stickyBottom={
          <CuadreConceptosBar
            resultado={cuadre}
            subtotal={sub}
            moneda={moneda}
            renglones={conceptosParaCuadre.length}
          />
        }
        bodyClassName="lg:grid lg:grid-cols-[1.15fr_1fr] lg:gap-6 lg:items-start lg:space-y-0"
      >
        <ColumnaDocumento
          ctl={ctl}
          categorias={cats.data ?? []}
          entrante={entrante ?? null}
          autocarga={autocarga}
          keyRenglonSospechoso={keyRenglonSospechoso}
          onVerFacturaDuplicada={(id) => {
            ctl.reset();
            onOpenChange(false);
            navigate(`/compras/facturas?factura=${id}`);
          }}
        />

        <ColumnaDatosFactura ctl={ctl} categorias={cats.data ?? []} />


      </FormDialogShell>

      {ctl.askCrearProv && (
        <CrearProveedorDesdeCfdiDialog
          open={!!ctl.askCrearProv}
          onOpenChange={(o) => { if (!o) ctl.setAskCrearProv(null); }}
          rfc={ctl.askCrearProv.rfc}
          nombre={ctl.askCrearProv.nombre}
          organizationId={ctl.organizationId}
          onCreated={(id, nombre) => {
            ctl.handleProveedor(id, nombre);
            ctl.setAskCrearProv(null);
          }}
        />
      )}
    </>
  );
}
