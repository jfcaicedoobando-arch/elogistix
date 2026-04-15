import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, Banknote, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useCotizacionCostos, useUpsertCotizacionCostos, CostoCotizacion,
} from "@/hooks/useCotizacionCostos";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { calcularTotalesPL } from "@/lib/profitUtils";
import ResumenPL from "./ResumenPL";
import TablaCostosLocal from "./TablaCostosLocal";
import TablaCostosDetalle from "./TablaCostosDetalle";

// ─── Shared types ────────────────────────────────────────────
export interface FilaCostoLocal {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  unidad_medida: string;
  aplica_iva?: boolean;
  notas?: string;
}

interface FilaCostoDetalle {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  venta: number;
  aplica_iva?: boolean;
  notas?: string;
}

// ─── Discriminated union props ───────────────────────────────
interface PropsLocal {
  tipo: "local";
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
}

interface PropsDetalle {
  tipo: "detalle";
  cotizacionId: string;
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
}

type Props = PropsLocal | PropsDetalle;

// ─── Shared utilities ────────────────────────────────────────
function calcTotals(rows: { cantidad: number; costo: number; venta: number }[]) {
  return calcularTotalesPL(
    rows.map(r => ({ cantidad: r.cantidad, costo_unitario: r.costo, precio_venta: r.venta / (r.cantidad || 1) }))
  );
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════
export default function SeccionCostosInternosPLUnificado(props: Props) {
  if (props.tipo === "local") return <ModoLocal {...props} />;
  return <ModoDetalle {...props} />;
}

// ═══════════════════════════════════════════════════════════════
// MODO LOCAL (NuevaCotizacion wizard)
// ═══════════════════════════════════════════════════════════════
function ModoLocal({ filas, setFilas }: PropsLocal) {
  const filasUSD = useMemo(() => filas.filter(f => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter(f => f.moneda === "MXN"), [filas]);

  const updateFila = (globalIdx: number, field: keyof FilaCostoLocal, value: string | number | boolean) => {
    setFilas(prev => {
      const copy = [...prev];
      copy[globalIdx] = { ...copy[globalIdx], [field]: value };
      return copy;
    });
  };

  const addFila = (moneda: "USD" | "MXN") => {
    setFilas(prev => [...prev, {
      concepto: "", moneda, proveedor: "", cantidad: 1,
      costo_unitario: 0, precio_venta: 0, unidad_medida: "",
      aplica_iva: moneda === "MXN", notas: "",
    }]);
  };

  const removeFila = (globalIdx: number) => {
    setFilas(prev => prev.filter((_, i) => i !== globalIdx));
  };

  const totalesUSD = useMemo(() => calcTotals(
    filasUSD.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta }))
  ), [filasUSD]);

  const totalesMXN = useMemo(() => calcTotals(
    filasMXN.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta }))
  ), [filasMXN]);

  return (
    <div className="space-y-4">
      <TablaCostosLocal
        filas={filas} filasMoneda={filasUSD} moneda="USD"
        title="Costos en USD" icon={<DollarSign className="h-4 w-4 text-violet-500" />}
        totales={totalesUSD} onUpdate={updateFila} onAdd={addFila} onRemove={removeFila}
      />
      <TablaCostosLocal
        filas={filas} filasMoneda={filasMXN} moneda="MXN"
        title="Costos en MXN" icon={<Banknote className="h-4 w-4 text-violet-500" />}
        totales={totalesMXN} onUpdate={updateFila} onAdd={addFila} onRemove={removeFila}
      />
      <ResumenPL
        totalesUSD={totalesUSD} totalesMXN={totalesMXN}
        tieneUSD={filasUSD.length > 0} tieneMXN={filasMXN.length > 0}
        mostrarRentabilidadGlobal
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODO DETALLE (CotizacionDetalle — loads from DB)
// ═══════════════════════════════════════════════════════════════
function ModoDetalle({ cotizacionId, conceptosUSD, conceptosMXN }: PropsDetalle) {
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const { data: costosGuardados, isLoading } = useCotizacionCostos(cotizacionId);
  const upsert = useUpsertCotizacionCostos();

  const [filas, setFilas] = useState<FilaCostoDetalle[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoading || initialized) return;

    if (costosGuardados && costosGuardados.length > 0) {
      const normalize = (s: string) => (s ?? '').trim().toLowerCase();
      let idxUSD = 0;
      let idxMXN = 0;
      const mapped: FilaCostoDetalle[] = costosGuardados.map((c) => {
        let venta = 0;
        let aplica_iva = false;
        if (c.moneda === "USD") {
          const cv = conceptosUSD.find(v => normalize(v.descripcion) === normalize(c.concepto))
            || conceptosUSD[idxUSD++];
          venta = cv ? cv.cantidad * cv.precio_unitario : 0;
          aplica_iva = cv?.aplica_iva ?? false;
        } else {
          const cv = conceptosMXN.find(v => normalize(v.descripcion) === normalize(c.concepto))
            || conceptosMXN[idxMXN++];
          venta = cv ? cv.cantidad * cv.precio_unitario : 0;
        }
        return { concepto: c.concepto, moneda: c.moneda as "USD" | "MXN", proveedor: c.proveedor, cantidad: c.cantidad, costo_unitario: c.costo_unitario, venta, aplica_iva, notas: (c as any).notas ?? "" };
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

  const updateFila = (index: number, field: "proveedor" | "costo_unitario", value: string) => {
    setFilas(prev => {
      const copy = [...prev];
      if (field === "costo_unitario") copy[index] = { ...copy[index], costo_unitario: parseFloat(value) || 0 };
      else copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const totalesUSD = useMemo(() => calcTotals(
    filasUSD.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.venta }))
  ), [filasUSD]);

  const totalesMXN = useMemo(() => calcTotals(
    filasMXN.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.venta }))
  ), [filasMXN]);

  const handleGuardar = async () => {
    const costos: CostoCotizacion[] = filas.map((f) => ({
      id: "", cotizacion_id: cotizacionId, concepto: f.concepto, moneda: f.moneda,
      proveedor: f.proveedor, cantidad: f.cantidad, costo_unitario: f.costo_unitario,
      costo_total: f.cantidad * f.costo_unitario, notas: f.notas ?? "", created_at: "", updated_at: "",
    }));
    try {
      await upsert.mutateAsync({ cotizacionId, costos });
      toast({ title: "Costos guardados correctamente" });
    } catch (err: unknown) {
      toast({ title: "Error al guardar", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      <TablaCostosDetalle
        filas={filas} filasMoneda={filasUSD} moneda="USD"
        title="Costos en USD" icon={<DollarSign className="h-4 w-4 text-violet-500" />}
        totales={totalesUSD} canEdit={canEdit} onUpdate={updateFila}
      />
      <TablaCostosDetalle
        filas={filas} filasMoneda={filasMXN} moneda="MXN"
        title="Costos en MXN" icon={<Banknote className="h-4 w-4 text-violet-500" />}
        totales={totalesMXN} canEdit={canEdit} onUpdate={updateFila}
      />
      <ResumenPL
        totalesUSD={totalesUSD} totalesMXN={totalesMXN}
        tieneUSD={filasUSD.length > 0} tieneMXN={filasMXN.length > 0}
        notaPie="El IVA no forma parte del profit"
      />
      {canEdit && filas.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={upsert.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {upsert.isPending ? "Guardando..." : "Guardar Costos"}
          </Button>
        </div>
      )}
    </div>
  );
}
