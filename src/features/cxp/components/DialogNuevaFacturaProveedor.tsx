/**
 * Captura de factura de proveedor: manual, por XML CFDI, por PDF con IA o
 * desde el buzón CxP (v13.366.0).
 * v13.400.0 — Optimizado para HD: ancho 4xl, dos columnas desde `lg`, KPIs de
 * totales fijos arriba y semáforo de cuadre fijo sobre el footer.
 * v13.507.0 — Modo buzón: hereda proveedor, nota y conceptos que declaró
 * operaciones, y esconde la carga de archivos porque el documento ya existe.
 */
import { useNavigate } from "react-router-dom";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import { usePermissions } from "@/hooks/shared";
import { DialogFacturaProveedorSinPermiso } from "@/features/cxp/components/DialogFacturaProveedorSinPermiso";
import { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import { CuadreConceptosBar } from "./CuadreConceptosBar";
import { TotalesChipDesglose } from "./TotalesChipDesglose";
import { PendientesGuardarHint } from "./PendientesGuardarHint";
import {
  BandaOrigenYAlertas, ColumnaDocumento, ColumnaDatosFactura,
} from "./DialogNuevaFacturaProveedor.columnas";

import { useCuadreCaptura } from "@/features/cxp/hooks/useCuadreCaptura";
import { usePrefillVinculosEntrante } from "@/features/cxp/hooks/usePrefillVinculosEntrante";
import { useHerenciaEntrante } from "@/features/cxp/hooks/useHerenciaEntrante";
import { useCategoriaCogsBuzon } from "@/features/cxp/hooks/useCategoriaCogsBuzon";
import { useAutocargaEntrante } from "@/features/cxp/hooks/useAutocargaEntrante";
import { abrirFacturaEntrante } from "@/features/cxp/services/facturasEntrantes";
import { notifyError } from "@/lib/ui/appFeedback";
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

  useHerenciaEntrante({
    entrante, abierto: open,
    provIdActual: ctl.values.provId,
    notaActual: ctl.values.notas,
    onProveedor: (id, nombre) => ctl.handleProveedor(id, nombre),
    onNota: (nota) => ctl.handleChange("notas", nota),
  });
  const categoriaCogs = useCategoriaCogsBuzon({
    categorias: cats.data ?? [],
    documentoId: entrante?.id ?? null,
    expediente: entrante?.expediente ?? null,
    abierto: open,
    categoriaActual: ctl.values.categoriaId,
    onCategoria: (id) => ctl.handleChange("categoriaId", id),
  });
  const herencia = usePrefillVinculosEntrante({
    entrante, abierto: open, habilitado: Boolean(ctl.values.provId),
    aplicarSugerencias: ctl.aplicarSugerencias,
  });

  const verArchivoBuzon = async (path: string, nombre: string) => {
    try {
      await abrirFacturaEntrante(path, nombre);
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo abrir el archivo del buzón",
        error,
        method: "ABRIR_FACTURA_ENTRANTE_CAPTURA",
      });
    }
  };

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
      <PendientesGuardarHint
        values={ctl.values}
        total={ctl.total}
        topeExcedido={ctl.topeVinculacion.excede}
        cfdiDuplicado={!!ctl.cfdiDuplicado}
        avisoMontoDeclarado={
          entrante
            ? {
                montoDeclarado: entrante.montoDeclarado,
                monedaDeclarada: entrante.monedaDeclarada,
              }
            : undefined
        }
        sinVinculos={Boolean(entrante) && Object.keys(ctl.vinculos).length === 0}
      />
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
        headerAside={
          <TotalesChipDesglose
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
      >
        <div
          className="space-y-5"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && ctl.puedeGuardar) {
              e.preventDefault();
              void ctl.submit();
            }
          }}
        >
          <BandaOrigenYAlertas
            ctl={ctl}
            entrante={entrante ?? null}
            autocarga={autocarga}
            modoBuzon={Boolean(entrante)}
            onVerArchivoBuzon={(path, nombre) => void verArchivoBuzon(path, nombre)}
            onVerFacturaDuplicada={(id: string) => {
              ctl.reset();
              onOpenChange(false);
              navigate(`/compras/facturas?factura=${id}`);
            }}
          />

          <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:gap-6 lg:items-start">
            <ColumnaDocumento
              ctl={ctl}
              categorias={cats.data ?? []}
              keyRenglonSospechoso={keyRenglonSospechoso}
              modoBuzon={Boolean(entrante)}
            />
            <ColumnaDatosFactura
              ctl={ctl}
              categorias={cats.data ?? []}
              herencia={entrante ? herencia : null}
              sinCostoCapturado={entrante?.sinCostoCapturado}
              entrante={entrante ?? null}
              categoriaCogs={entrante ? categoriaCogs : null}
            />
          </div>
        </div>
      </FormDialogShell>

    </>
  );
}

