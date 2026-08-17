/**
 * Diálogo para corregir los conceptos de una factura de proveedor capturada a
 * mano (v13.628.0). Reutiliza la misma captura del modal de alta y valida el
 * cuadre contra el subtotal antes de guardar.
 */
import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { ConceptosManualesSection } from "@/features/cxp/components/ConceptosManualesSection";
import { useConceptosManuales } from "@/features/cxp/hooks/useConceptosManuales";
import { useConceptosCfdiFactura } from "@/features/cxp/hooks/useConceptosCfdiFactura";
import { useEditarConceptosFactura } from "@/features/cxp/hooks/useEditarConceptosFactura";
import { calcularCuadreConceptos } from "@/features/cxp/utils/cuadreConceptos";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facturaId: string;
  folio: string;
  moneda: string;
  subtotal: number;
}

export function DialogEditarConceptosFactura({
  open, onOpenChange, facturaId, folio, moneda, subtotal,
}: Props) {
  const { data: actuales = [] } = useConceptosCfdiFactura(open ? facturaId : null);
  const api = useConceptosManuales();
  const { mutateAsync, isPending } = useEditarConceptosFactura(facturaId);
  const [precargado, setPrecargado] = useState(false);

  useEffect(() => {
    if (!open) {
      setPrecargado(false);
      api.limpiar();
      return;
    }
    if (precargado || actuales.length === 0) return;
    api.reemplazar(actuales.map((c) => ({
      descripcion: c.descripcion ?? "",
      cantidad: Number(c.cantidad) || 1,
      clave_unidad: c.clave_unidad ?? undefined,
      importe: Number(c.monto) || 0,
      iva: Number(c.iva) || 0,
      ieps: Number(c.ieps) || 0,
    })));
    setPrecargado(true);
  }, [open, actuales, precargado, api]);

  const cuadre = calcularCuadreConceptos(
    subtotal,
    api.conceptos.map((c) => ({
      monto: Number(c.importe) || 0,
      cantidad: Number(c.cantidad) || 1,
    })),
  );

  const guardar = async () => {
    await mutateAsync({ folio, conceptos: api.conceptos });
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ListPlus}
      title={`Editar conceptos · ${folio}`}
      description="Sólo aplica a facturas capturadas a mano, sin pagos y no canceladas. El cambio queda en la bitácora."
      size="lg"
      footer={
        <FormDialogFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={guardar}
          confirmLabel="Guardar conceptos"
          loading={isPending}
          disabled={api.conceptos.length === 0}
          extra={
            <div className="text-2xs leading-tight text-muted-foreground">
              <div className="whitespace-nowrap">
                Suma:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatCurrency(cuadre.suma, moneda)}
                </span>
              </div>
              <div className="whitespace-nowrap">
                Subtotal:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatCurrency(subtotal, moneda)}
                </span>
              </div>
            </div>
          }
        />
      }
    >
      {cuadre.estado !== "cuadrado" && api.conceptos.length > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed">
          La suma de líneas difiere del subtotal en{" "}
          <strong className="tabular-nums">
            {formatCurrency(Math.abs(cuadre.diferencia), moneda)}
          </strong>
          . Puedes guardar, pero la factura no se podrá aprobar hasta que cuadre.
        </p>
      )}
      <ConceptosManualesSection
        conceptos={api.conceptos}
        moneda={moneda}
        onAgregar={api.agregar}
        onActualizar={api.actualizar}
        onEliminar={api.eliminar}
      />

    </FormDialogShell>
  );
}
