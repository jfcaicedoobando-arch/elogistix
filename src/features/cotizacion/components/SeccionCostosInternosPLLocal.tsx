import { useMemo, useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { DollarSign, Banknote, Link2 } from "lucide-react";
import ResumenPL from "./ResumenPL";
import TablaCostosLocal from "./TablaCostosLocal";
import { calcTotalsPL, type FilaCostoLocal } from "./costosPLTypes";
import { fetchRecargosDeTarifa, fetchTopTarifas } from "@/features/costeo/services/topTarifas";
import { fetchTarifaVinculada } from "@/features/cotizacion/services/tarifaVinculada";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

interface Props {
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
}

/**
 * Modo "local": gestiona costos en memoria durante el wizard de NuevaCotizacion.
 * Si en Paso 1 hay tarifa vinculada (`tarifaId`), precarga flete + recargos
 * automáticamente al montar (sólo si la lista está vacía).
 */
export default function SeccionCostosInternosPLLocal({ filas, setFilas }: Props) {
  const { watch } = useFormContext<CotizacionFormValues>();
  const tarifaId = watch("tarifaId");
  const { data: tarifa } = useTarifaVinculada(tarifaId);

  const filasUSD = useMemo(() => filas.filter(f => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter(f => f.moneda === "MXN"), [filas]);

  const precargadaRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tarifaId) return;
    if (precargadaRef.current === tarifaId) return;
    if (filas.length > 0) { precargadaRef.current = tarifaId; return; }
    let cancelado = false;
    (async () => {
      const row = await fetchTarifaVinculada(tarifaId);
      if (cancelado || !row) return;
      const recargos = await fetchRecargosDeTarifa(row.id);
      if (cancelado) return;
      const nuevas = construirFilasDesdeTarifa(row, recargos);
      setFilas(prev => (prev.length > 0 ? prev : nuevas));
      precargadaRef.current = tarifaId;
    })();
    return () => { cancelado = true; };
  }, [tarifaId, filas.length, setFilas]);

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

  const totalesUSD = useMemo(() => calcTotalsPL(
    filasUSD.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta })),
  ), [filasUSD]);

  const totalesMXN = useMemo(() => calcTotalsPL(
    filasMXN.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta })),
  ), [filasMXN]);

  return (
    <div className="space-y-4">
      {tarifa && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <Link2 className="size-4 text-primary" />
          <span>
            Costos precargados desde tarifa <strong>{tarifa.naviera_nombre}</strong> ({tarifa.puerto_origen_nombre} → {tarifa.puerto_destino_nombre}).
            Puedes editar, agregar o eliminar conceptos.
          </span>
        </div>
      )}
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

function construirFilasDesdeTarifa(
  row: TopTarifaRow,
  recargos: Awaited<ReturnType<typeof fetchRecargosDeTarifa>>,
): FilaCostoLocal[] {
  return [
    {
      concepto: `Flete marítimo ${row.puerto_origen_nombre} → ${row.puerto_destino_nombre} (${row.tipo_contenedor_nombre})`,
      moneda: "USD",
      proveedor: row.agente_nombre,
      cantidad: 1,
      costo_unitario: Number(row.flete_base),
      precio_venta: Number(row.flete_base),
      unidad_medida: "contenedor",
      aplica_iva: false,
      notas: `Costeo · vigente hasta ${row.vigente_hasta}`,
    },
    ...recargos
      .filter(r => r.incluido_en_total)
      .map<FilaCostoLocal>(r => ({
        concepto: `${r.concepto} (${r.lado})`,
        moneda: "USD",
        proveedor: row.agente_nombre,
        cantidad: 1,
        costo_unitario: Number(r.monto),
        precio_venta: Number(r.monto),
        unidad_medida: "contenedor",
        aplica_iva: false,
        notas: `Costeo · tarifa ${row.id.slice(0, 8)}`,
      })),
  ];
}

// Mantengo el import de fetchTopTarifas para evitar romper otras refs accidentales.
void fetchTopTarifas;
