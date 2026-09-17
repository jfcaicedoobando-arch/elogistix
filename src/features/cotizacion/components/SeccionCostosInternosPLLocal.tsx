import { useMemo } from "react";
import { DollarSign, Banknote, Link2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TablaCostosLocal from "./TablaCostosLocal";
import AvisoCostosDesactualizados from "./AvisoCostosDesactualizados";

import { calcTotalsPL, type FilaCostoLocal } from "./costosPLTypes";
import { useCostosAutoSync } from "@/features/cotizacion/hooks/wizard/useCostosAutoSync";
import { marcarEditadaAMano, type DesajusteCostos } from "@/features/cotizacion/domain/costosAutoGenerados";

/** Campos cuya edición manual desvincula la fila de su origen automático. */
const CAMPOS_DESVINCULAN = new Set<keyof FilaCostoLocal>([
  "concepto", "moneda", "proveedor", "cantidad", "costo_unitario", "precio_venta", "unidad_medida",
]);


interface Props {
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
  /** Q2/Q6 (v13.823.396): informa al wizard si los costos automáticos están al día. */
  onDesajusteChange?: (d: DesajusteCostos | null) => void;
}

/**
 * Modo "local": gestiona costos en memoria durante el wizard de NuevaCotizacion.
 * La precarga desde tarifa / flete LCL manual y la detección de costos
 * automáticos desactualizados viven en `useCostosAutoSync`.
 */
export default function SeccionCostosInternosPLLocal({ filas, setFilas, onDesajusteChange }: Props) {
  const { tarifa, mostrarAvisoLclFcl, lclAutoCargado, desajuste, recalculando, recalcular } =
    useCostosAutoSync({ filas, setFilas, onDesajusteChange });

  const filasUSD = useMemo(() => filas.filter(f => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter(f => f.moneda === "MXN"), [filas]);

  const updateFila = (globalIdx: number, field: keyof FilaCostoLocal, value: string | number | boolean) => {
    setFilas(prev => {
      const copy = [...prev];
      const editada = { ...copy[globalIdx], [field]: value };
      // Q2/Q6: editar a mano una fila auto-generada la desvincula del Paso 1;
      // así el aviso de "costos desactualizados" no bloquea el avance ni el
      // recálculo pisa lo que el usuario acaba de capturar.
      copy[globalIdx] = CAMPOS_DESVINCULAN.has(field) ? marcarEditadaAMano(editada) : editada;
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
    <div className="space-y-6">
      {desajuste && (
        <AvisoCostosDesactualizados
          desajuste={desajuste}
          recalculando={recalculando}
          onRecalcular={recalcular}
        />
      )}
      {mostrarAvisoLclFcl && (
        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            La tarifa vinculada está capturada para contenedor (<strong>{tarifa?.tipo_contenedor_nombre}</strong>), pero esta cotización es <strong>LCL</strong>.
            Los costos se precargan en <strong>m³</strong>; revisa cantidades y unidades antes de continuar.
          </AlertDescription>
        </Alert>
      )}
      {tarifa && (
        <Alert variant="info">
          <Link2 className="size-4" />
          <AlertDescription>
            Costos precargados desde tarifa <strong>{tarifa.naviera_nombre}</strong> ({tarifa.puerto_origen_nombre} → {tarifa.puerto_destino_nombre}).
            Puedes editar, agregar o eliminar conceptos.
          </AlertDescription>
        </Alert>
      )}
      {lclAutoCargado && !tarifa && (
        <Alert variant="info">
          <Link2 className="size-4" />
          <AlertDescription>
            Flete LCL precargado desde el Paso 1 (captura manual). Puedes editar, agregar o eliminar conceptos.
          </AlertDescription>
        </Alert>
      )}

      <TablaCostosLocal
        filas={filas} filasMoneda={filasUSD} moneda="USD"
        title="Costos en USD" icon={<DollarSign className="size-4 text-accent" />}
        totales={totalesUSD} onUpdate={updateFila} onAdd={addFila} onRemove={removeFila}
      />
      <TablaCostosLocal
        filas={filas} filasMoneda={filasMXN} moneda="MXN"
        title="Costos en MXN" icon={<Banknote className="size-4 text-accent" />}
        totales={totalesMXN} onUpdate={updateFila} onAdd={addFila} onRemove={removeFila}
      />
      {/* La utilidad consolidada vive en la barra fija inferior del wizard
          (misma cifra, un solo lugar): aquí sólo queda la aclaración de IVA. */}
      <p className="text-body-sm text-muted-foreground">
        * El IVA no forma parte de la utilidad.
      </p>
    </div>
  );
}
