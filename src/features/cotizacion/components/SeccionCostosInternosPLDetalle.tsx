import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, Banknote, Save, Pencil, X } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { sumarSubtotales } from "@/lib/financial/financialUtils";
import { usePermissions } from "@/hooks/shared";
import {
  useCotizacionCostos, useUpsertCotizacionCostos, type CostoCotizacion,
} from "@/features/cotizacion/hooks";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";
import ResumenPL from "./ResumenPL";
import TablaCostosDetalle from "./TablaCostosDetalle";
import { calcTotalsPL, type FilaCostoDetalle } from "./costosPLTypes";
// O3: match costos↔conceptos centralizado, sólo por nombre normalizado
// (A-5: sin fallback posicional — ver matchConceptoVenta.ts).
import { matchConceptoVenta } from "@/features/cotizacion/utils/matchConceptoVenta";
import { useTasaIVA } from "@/features/catalogos/hooks";
import { requiereSincronizarVenta } from "@/features/cotizacion/domain/cotizacionVentaSync";
import { AvisoSincronizarConceptosVenta } from "./AvisoSincronizarConceptosVenta";

interface Props {
  cotizacionId: string;
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
}

/**
 * Modo "detalle": carga/persiste costos desde la BD para una cotización existente.
 * Usado en CotizacionDetalle.
 */
export default function SeccionCostosInternosPLDetalle({ cotizacionId, conceptosUSD, conceptosMXN }: Props) {
  const { canEdit } = usePermissions();
  const { data: costosGuardados, isLoading } = useCotizacionCostos(cotizacionId);
  const upsert = useUpsertCotizacionCostos();
  const tasaIva = useTasaIVA();
  // B-081: venta ya persistida en `conceptos_venta`; si suma 0 y los costos sí
  // traen venta, ofrecemos re-sincronizar.
  const totalVentaGuardada = useMemo(
    // BL-12: canon `sumarSubtotales` (subtotalLinea por fila) — el reduce
    // crudo `cantidad * precio_unitario` generaba drift de centavos vs BD.
    () => sumarSubtotales([...conceptosUSD, ...conceptosMXN], (c) => ({
      cantidad: Number(c.cantidad) || 0,
      precioUnitario: Number(c.precio_unitario) || 0,
    })),
    [conceptosUSD, conceptosMXN],
  );

  const [filas, setFilas] = useState<FilaCostoDetalle[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    // v13.823.144 (bug 8/9): antes el mapeo corría UNA sola vez; tras
    // "Sincronizar conceptos de venta" la tabla seguía mostrando Venta 0.
    // Ahora se re-deriva cuando cambian los datos de BD, salvo mientras el
    // usuario está editando (para no pisar su captura).
    if (isLoading || (initialized && editMode)) return;

    if (costosGuardados && costosGuardados.length > 0) {
      const mapped: FilaCostoDetalle[] = costosGuardados.map((c) => {
        // Fuente única de venta: el `precio_venta` persistido en el costo.
        // El match por nombre contra `conceptos_venta` queda sólo como
        // respaldo para filas legacy sin `precio_venta`.
        const ventaCosto = (Number(c.precio_venta) || 0) * (Number(c.cantidad) || 0);
        const cv = matchConceptoVenta(c.moneda === "USD" ? conceptosUSD : conceptosMXN, c.concepto);
        const venta = ventaCosto > 0 ? ventaCosto : (cv ? cv.cantidad * cv.precio_unitario : 0);
        const aplica_iva = c.moneda === "USD" ? (cv?.aplica_iva ?? false) : false;
        return {
          concepto: c.concepto,
          moneda: c.moneda as "USD" | "MXN",
          proveedor: c.proveedor,
          cantidad: c.cantidad,
          costo_unitario: c.costo_unitario,
          venta,
          aplica_iva,
          notas: (c as { notas?: string }).notas ?? "",
        };
      });
      setFilas(mapped);
    } else {
      const fromUSD: FilaCostoDetalle[] = conceptosUSD.map((c) => ({
        concepto: c.descripcion, moneda: "USD" as const, proveedor: "", cantidad: c.cantidad, costo_unitario: 0,
        venta: c.cantidad * c.precio_unitario, aplica_iva: c.aplica_iva ?? false, notas: "",
      }));
      const fromMXN: FilaCostoDetalle[] = conceptosMXN.map((c) => ({
        concepto: c.descripcion, moneda: "MXN" as const, proveedor: "", cantidad: c.cantidad, costo_unitario: 0,
        venta: c.cantidad * c.precio_unitario, notas: "",
      }));
      setFilas([...fromUSD, ...fromMXN]);
    }
    setInitialized(true);
  }, [isLoading, costosGuardados, conceptosUSD, conceptosMXN, initialized]);

  const filasUSD = useMemo(() => filas.filter(f => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter(f => f.moneda === "MXN"), [filas]);

  const updateFila = (index: number, field: "proveedor" | "costo_unitario" | "venta" | "notas", value: string) => {
    setFilas(prev => {
      const copy = [...prev];
      // Bug 9: la venta ya es editable; se guarda como `precio_venta` por unidad.
      if (field === "costo_unitario" || field === "venta") {
        copy[index] = { ...copy[index], [field]: parseFloat(value) || 0 };
      } else copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const totalesUSD = useMemo(() => calcTotalsPL(
    filasUSD.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.venta })),
  ), [filasUSD]);

  const totalesMXN = useMemo(() => calcTotalsPL(
    filasMXN.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.venta })),
  ), [filasMXN]);

  const handleGuardar = async () => {
    const costos: CostoCotizacion[] = filas.map((f) => ({
      id: "", cotizacion_id: cotizacionId, concepto: f.concepto, moneda: f.moneda,
      proveedor: f.proveedor, cantidad: f.cantidad, costo_unitario: f.costo_unitario,
      costo_total: f.cantidad * f.costo_unitario,
      // B-081: el upsert borra y reinserta; sin esto se perdía el precio de venta
      // y la cotización quedaba sin importes de venta en la BD.
      precio_venta: f.cantidad > 0 ? f.venta / f.cantidad : f.venta,
      notas: f.notas ?? "", created_at: "", updated_at: "",
    }));
    try {
      await upsert.mutateAsync({ cotizacionId, costos });
      notifySuccess(undefined, { title: "Costos guardados correctamente" });
      setEditMode(false);
    } catch (err: unknown) {
      notifyError(undefined, { title: "Error al guardar", description: getErrorMessage(err), error: err, method: "HANDLE_GUARDAR" });
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      <AvisoSincronizarConceptosVenta
        cotizacionId={cotizacionId}
        costos={costosGuardados ?? []}
        tasaIva={tasaIva}
        visible={requiereSincronizarVenta(costosGuardados ?? [], totalVentaGuardada)}
      />

      {canEdit && filas.length > 0 && (
        <div className="flex justify-end">
          {editMode ? (
            <Button variant="outline" size="sm" onClick={() => setEditMode(false)} disabled={upsert.isPending}>
              <X className="h-4 w-4 mr-1" /> Cancelar edición
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar costos
            </Button>
          )}
        </div>
      )}
      <TablaCostosDetalle
        filas={filas} filasMoneda={filasUSD} moneda="USD"
        title="Costos en USD" icon={<DollarSign className="h-4 w-4 text-primary" />}
        totales={totalesUSD} canEdit={canEdit && editMode} onUpdate={updateFila}
      />
      <TablaCostosDetalle
        filas={filas} filasMoneda={filasMXN} moneda="MXN"
        title="Costos en MXN" icon={<Banknote className="h-4 w-4 text-primary" />}
        totales={totalesMXN} canEdit={canEdit && editMode} onUpdate={updateFila}
      />
      <ResumenPL
        totalesUSD={totalesUSD} totalesMXN={totalesMXN}
        tieneUSD={filasUSD.length > 0} tieneMXN={filasMXN.length > 0}
        notaPie="El IVA no forma parte del profit"
      />
      {canEdit && editMode && filas.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={upsert.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {upsert.isPending ? "Guardando…" : "Guardar Costos"}
          </Button>
        </div>
      )}
    </div>
  );
}
