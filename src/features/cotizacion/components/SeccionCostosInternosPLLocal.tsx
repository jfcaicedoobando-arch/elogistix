import { useMemo, useState } from "react";
import { DollarSign, Banknote, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import ResumenPL from "./ResumenPL";
import TablaCostosLocal from "./TablaCostosLocal";
import { calcTotalsPL, type FilaCostoLocal } from "./costosPLTypes";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import { fetchRecargosDeTarifa } from "@/features/costeo/services/topTarifas";
import type { TopTarifaRow } from "@/features/costeo/types";

interface Props {
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
}

/**
 * Modo "local": gestiona costos en memoria durante el wizard de NuevaCotizacion.
 * No persiste en BD; el caller se encarga de guardar al confirmar la cotización.
 * Botón "Buscar tarifa Costeo" precarga flete + recargos del Top 3.
 */
export default function SeccionCostosInternosPLLocal({ filas, setFilas }: Props) {
  const filasUSD = useMemo(() => filas.filter(f => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter(f => f.moneda === "MXN"), [filas]);
  const [openCosteo, setOpenCosteo] = useState(false);

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

  const aplicarTarifaCosteo = async (row: TopTarifaRow) => {
    const recargos = await fetchRecargosDeTarifa(row.id);
    const nuevas: FilaCostoLocal[] = [
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
        .filter((r) => r.incluido_en_total)
        .map<FilaCostoLocal>((r) => ({
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
    setFilas((prev) => [...prev, ...nuevas]);
  };

  const totalesUSD = useMemo(() => calcTotalsPL(
    filasUSD.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta })),
  ), [filasUSD]);

  const totalesMXN = useMemo(() => calcTotalsPL(
    filasMXN.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta })),
  ), [filasMXN]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpenCosteo(true)}>
          <Search className="size-4 mr-2" /> Buscar tarifa Costeo
        </Button>
      </div>
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

      <BuscarTarifaDialog
        open={openCosteo}
        onOpenChange={setOpenCosteo}
        onElegir={aplicarTarifaCosteo}
        selectLabel="Usar esta tarifa"
      />
    </div>
  );
}
