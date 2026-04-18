import { useMemo } from "react";
import { DollarSign, Banknote } from "lucide-react";
import ResumenPL from "./ResumenPL";
import TablaCostosLocal from "./TablaCostosLocal";
import { calcTotalsPL, type FilaCostoLocal } from "./costosPLTypes";

interface Props {
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
}

/**
 * Modo "local": gestiona costos en memoria durante el wizard de NuevaCotizacion.
 * No persiste en BD; el caller se encarga de guardar al confirmar la cotización.
 */
export default function SeccionCostosInternosPLLocal({ filas, setFilas }: Props) {
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

  const totalesUSD = useMemo(() => calcTotalsPL(
    filasUSD.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta })),
  ), [filasUSD]);

  const totalesMXN = useMemo(() => calcTotalsPL(
    filasMXN.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta })),
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
