import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, Banknote, Save, Pencil, X } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { sumarSubtotales } from "@/lib/financial/financialUtils";
import { usePermissions } from "@/hooks/shared";
import { useCotizacionCostos, useUpsertCotizacionCostos } from "@/features/cotizacion/hooks";
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
  cotizacionId, conceptosUSD, conceptosMXN, cotizacionUpdatedAt = null,
}: Props) {
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
  /**
   * v13.823.165 — `sello` es el sello de la lectura COHERENTE que se está
   * mostrando (nunca se toma de la prop al momento de guardar). `selloConsumido`
   * es el que ya se gastó en un guardado exitoso: si un refetch tardío devuelve
   * ese valor viejo, se ignora en lugar de degradar el sello vigente. Cualquier
   * OTRO valor de la prop (p. ej. cambio de otro usuario mientras no se editaba)
   * sí se adopta junto con sus filas, para no conservar S1 indefinidamente.
   */
  const [sello, setSello] = useState<string | null>(cotizacionUpdatedAt);
  const [selloConsumido, setSelloConsumido] = useState<string | null>(null);

  const lecturaObsoleta =
    !!selloConsumido && !!cotizacionUpdatedAt && cotizacionUpdatedAt === selloConsumido;

  useEffect(() => {
    // v13.823.144 (bug 8/9): se re-deriva cuando cambian los datos de BD,
    // salvo mientras el usuario edita (para no pisar su captura).
    if (isLoading || (initialized && editMode)) return;
    // v13.823.165: no se rehidrata desde una lectura ya superada por el
    // guardado propio (abriría una ventana editable con datos/sello viejos).
    if (lecturaObsoleta) return;

    setFilas(
      costosGuardados && costosGuardados.length > 0
        ? mapearCostosAFilas(costosGuardados, conceptosUSD, conceptosMXN)
        : mapearConceptosAFilas(conceptosUSD, conceptosMXN),
    );
    if (cotizacionUpdatedAt) setSello(cotizacionUpdatedAt);
    setInitialized(true);
  }, [
    isLoading, costosGuardados, conceptosUSD, conceptosMXN, initialized, editMode,
    lecturaObsoleta, cotizacionUpdatedAt,
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
    const selloEnviado = sello;
    try {
      // Sin sello se falla cerrado en el servicio (no se sustituye por la prop).
      const res = await upsert.mutateAsync({
        cotizacionId, costos, expectedUpdatedAt: selloEnviado,
      });
      // v13.823.165: filas y sello se renuevan JUNTOS con lo que devuelve la RPC
      // (lectura canónica), y el sello gastado queda marcado como obsoleto para
      // que un refetch tardío no lo reinstale.
      if (res.costos.length > 0) {
        setFilas(mapearCostosAFilas(res.costos, conceptosUSD, conceptosMXN));
      }
      setSello(res.updatedAt ?? null);
      setSelloConsumido(selloEnviado);
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
            <Button
              variant="outline" size="sm" disabled={upsert.isPending}
              onClick={() => setEditMode(false)}
            >
              <X className="h-4 w-4 mr-1" /> Cancelar edición
            </Button>
          ) : (
            <Button
              variant="outline" size="sm"
              // v13.823.165: NO se reinstala la prop aquí; el sello vigente ya
              // es el de la lectura coherente mostrada (o el que devolvió la RPC).
              onClick={() => setEditMode(true)}
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
