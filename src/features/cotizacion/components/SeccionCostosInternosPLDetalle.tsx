import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, Banknote, Save, Pencil, X } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { sumarSubtotales } from "@/lib/financial/financialUtils";
import { usePermissions } from "@/hooks/shared";
import { useCotizacionCostosSnapshot, useUpsertCotizacionCostos } from "@/features/cotizacion/hooks";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";
import ResumenPL from "./ResumenPL";
import TablaCostosDetalle from "./TablaCostosDetalle";
import { calcTotalsPL, type FilaCostoDetalle } from "./costosPLTypes";
import {
  mapearCostosAFilas, mapearConceptosAFilas, mapearFilasACostos,
} from "@/features/cotizacion/domain/mapearCostosDetalle";
import { useTasaIVA } from "@/features/catalogos/hooks";
import { requiereSincronizarVenta } from "@/features/cotizacion/domain/cotizacionVentaSync";
import { AvisoSincronizarConceptosVenta } from "./AvisoSincronizarConceptosVenta";

interface Props {
  cotizacionId: string;
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
  /**
   * v13.823.164 — Sello (`cotizaciones.updated_at`) de los datos abiertos para
   * editar. Sin él el servicio falla cerrado con LC_CONFLICTO_CONCURRENCIA.
   */
  cotizacionUpdatedAt?: string | null;
}

/**
 * Modo "detalle": carga/persiste costos desde la BD para una cotización existente.
 * Usado en CotizacionDetalle.
 */
export default function SeccionCostosInternosPLDetalle({
  cotizacionId, conceptosUSD, conceptosMXN,
}: Props) {
  const { canEdit } = usePermissions();
  const { data: snapshot, isLoading } = useCotizacionCostosSnapshot(cotizacionId);
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

  const [filasConfirmadas, setFilasConfirmadas] = useState<FilaCostoDetalle[]>([]);
  const [filas, setFilas] = useState<FilaCostoDetalle[]>([]);
  const [selloConfirmado, setSelloConfirmado] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    // La captura abierta queda congelada. Fuera de edición se adopta únicamente
    // una fotografía completa (costos + sello de la misma consulta).
    if (isLoading || editMode || !snapshot) return;
    const selloAnterior = selloConfirmado ? Date.parse(selloConfirmado) : Number.NaN;
    const selloEntrante = snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : Number.NaN;
    if (Number.isFinite(selloAnterior) && (!Number.isFinite(selloEntrante) || selloEntrante < selloAnterior)) {
      return;
    }
    const filasSnapshot = snapshot.costos.length > 0
      ? mapearCostosAFilas(snapshot.costos, conceptosUSD, conceptosMXN)
      : mapearConceptosAFilas(conceptosUSD, conceptosMXN);
    setFilasConfirmadas(filasSnapshot);
    setFilas(filasSnapshot);
    setSelloConfirmado(snapshot.updatedAt);
  }, [
    isLoading, snapshot, conceptosUSD, conceptosMXN, editMode, selloConfirmado,
  ]);

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
    const costos = mapearFilasACostos(cotizacionId, filas);
    const selloEnviado = selloConfirmado;
    try {
      // Sin sello se falla cerrado en el servicio (no se sustituye por la prop).
      const res = await upsert.mutateAsync({
        cotizacionId, costos, expectedUpdatedAt: selloEnviado,
      });
      const filasGuardadas = res.costos.length > 0
        ? mapearCostosAFilas(res.costos, conceptosUSD, conceptosMXN)
        : mapearConceptosAFilas(conceptosUSD, conceptosMXN);
      setFilasConfirmadas(filasGuardadas);
      setFilas(filasGuardadas);
      setSelloConfirmado(res.updatedAt);
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
        costos={snapshot?.costos ?? []}
        tasaIva={tasaIva}
        visible={requiereSincronizarVenta(snapshot?.costos ?? [], totalVentaGuardada)}
      />

      {canEdit && filas.length > 0 && (
        <div className="flex justify-end">
          {editMode ? (
            <Button
              variant="outline" size="sm" disabled={upsert.isPending}
              onClick={() => {
                setFilas(filasConfirmadas);
                setEditMode(false);
              }}
            >
              <X className="h-4 w-4 mr-1" /> Cancelar edición
            </Button>
          ) : (
            <Button
              variant="outline" size="sm"
              disabled={!selloConfirmado}
              onClick={() => {
                setFilas(filasConfirmadas);
                setEditMode(true);
              }}
            >
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
