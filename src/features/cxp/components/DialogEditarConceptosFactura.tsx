/**
 * Diálogo para corregir los conceptos de una factura de proveedor capturada a
 * mano (v13.628.0). Reutiliza la misma captura del modal de alta y valida el
 * cuadre contra el subtotal antes de guardar.
 *
 * v13.629.0 — Semáforo de cuadre en el encabezado, resaltado del renglón
 * sospechoso y acción para cerrar la diferencia en la última línea.
 */
import { useEffect, useState } from "react";
import { ListPlus, Wand2 } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { Button } from "@/components/ui/button";
import { ConceptosManualesSection } from "@/features/cxp/components/ConceptosManualesSection";
import { CuadreConceptosChip } from "@/features/cxp/components/CuadreConceptosChip";
import { useConceptosManuales } from "@/features/cxp/hooks/useConceptosManuales";
import { useConceptosCfdiFactura } from "@/features/cxp/hooks/useConceptosCfdiFactura";
import { useEditarConceptosFactura } from "@/features/cxp/hooks/useEditarConceptosFactura";
import { calcularCuadreConceptos } from "@/features/cxp/utils/cuadreConceptos";
import { keyRenglonSospechoso } from "@/features/cxp/utils/cuadreResaltado";
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

  const lineas = api.conceptos.map((c) => ({
    key: c.key,
    monto: Number(c.importe) || 0,
    cantidad: Number(c.cantidad) || 1,
  }));
  const cuadre = calcularCuadreConceptos(subtotal, lineas);
  const resaltado = keyRenglonSospechoso(subtotal, lineas);
  const descuadrado = cuadre.estado === "faltante" || cuadre.estado === "sobrante";

  const guardar = async () => {
    await mutateAsync({ folio, conceptos: api.conceptos });
    onOpenChange(false);
  };

  const cerrarDiferencia = () => {
    const ultima = api.conceptos[api.conceptos.length - 1];
    if (ultima) api.ajustarDiferencia(ultima.key, cuadre.diferencia);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ListPlus}
      title={`Editar conceptos · ${folio}`}
      description="Sólo aplica a facturas capturadas a mano, sin pagos y no canceladas. El cambio queda en la bitácora."
      size="xl"
      headerAside={
        <CuadreConceptosChip
          estado={cuadre.estado}
          suma={cuadre.suma}
          subtotal={subtotal}
          diferencia={cuadre.diferencia}
          moneda={moneda}
        />
      }
      footer={
        <FormDialogFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={guardar}
          confirmLabel="Guardar conceptos"
          loading={isPending}
          disabled={api.conceptos.length === 0}
        />
      }
    >
      {descuadrado && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-body-sm">
          <span className="leading-relaxed">
            {cuadre.diferencia > 0 ? "Faltan " : "Sobran "}
            <strong className="tabular-nums">
              {formatCurrency(Math.abs(cuadre.diferencia), moneda)}
            </strong>{" "}
            para cuadrar con el subtotal. Puedes guardar, pero la factura no se podrá aprobar.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={cerrarDiferencia}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            Ajustar última línea
          </Button>
        </div>
      )}
      <ConceptosManualesSection
        conceptos={api.conceptos}
        moneda={moneda}
        keyResaltado={resaltado}
        onAgregar={api.agregar}
        onActualizar={api.actualizar}
        onEliminar={api.eliminar}
        onDuplicar={api.duplicar}
      />
    </FormDialogShell>
  );
}
