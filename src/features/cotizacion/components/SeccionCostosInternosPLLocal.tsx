import { useMemo, useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { DollarSign, Banknote, Link2, AlertTriangle } from "lucide-react";
import ResumenPL from "./ResumenPL";
import TablaCostosLocal from "./TablaCostosLocal";
import { calcTotalsPL, type FilaCostoLocal } from "./costosPLTypes";
import { fetchRecargosDeTarifa } from "@/features/costeo/services/topTarifas";
import { fetchTarifaVinculada } from "@/features/cotizacion/services/tarifaVinculada";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";
import { useConfigValue } from "@/features/configuracion/hooks/useConfiguracion";
import { buildCostosDesdeTarifa } from "@/features/cotizacion/components/seccionRuta/buildCostosDesdeTarifa";
import { buildCostosLCLManual } from "@/features/cotizacion/components/seccionRuta/buildCostosLCLManual";
import { useProveedoresLite } from "@/features/proveedor/hooks/useProveedores";
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
  const numContenedores = watch("numContenedores") ?? 1;
  const tipoEmbarque = watch("tipoEmbarque");
  const lclFleteManual = watch("lclFleteManual");
  const dimensionesLCL = watch("dimensionesLCL");
  const pesoKg = watch("pesoKg");
  const { data: tarifa } = useTarifaVinculada(tarifaId);
  const { data: proveedores = [] } = useProveedoresLite();
  const markup = useConfigValue<number>("cotizaciones", "markup_default_maritimo", 0.15);

  const filasUSD = useMemo(() => filas.filter(f => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter(f => f.moneda === "MXN"), [filas]);

  const precargadaRef = useRef<string | null>(null);
  const precargadaLclRef = useRef<boolean>(false);
  const [lclAutoCargado, setLclAutoCargado] = useState(false);

  // Detecta desajuste tarifa (FCL) ↔ cotización (LCL): la tabla `costeo_tarifas`
  // está modelada para contenedor; una tarifa con `tipo_contenedor_nombre` en una
  // cotización LCL genera unidades inconsistentes si no se convierte a m³.
  const tarifaEsFcl = !!tarifa?.tipo_contenedor_nombre;
  const cotizacionEsLcl = tipoEmbarque === "LCL";
  const mostrarAvisoLclFcl = tarifaEsFcl && cotizacionEsLcl;

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
      const nuevas = buildCostosDesdeTarifa({
        tarifa: row,
        recargos,
        markup,
        cantidad: Math.max(1, numContenedores || 1),
        tipoEmbarque,
      });
      setFilas(prev => (prev.length > 0 ? prev : nuevas));
      precargadaRef.current = tarifaId;
    })();
    return () => { cancelado = true; };
  }, [tarifaId, filas.length, setFilas, markup, numContenedores, tipoEmbarque]);

  // Precarga LCL manual: si el paso 1 capturó `lclFleteManual` con tarifa W/M
  // válida y no hay filas todavía, inyectamos una fila de flete USD para que
  // el ejecutivo no re-teclee. Se ejecuta una sola vez (guard con ref).
  useEffect(() => {
    if (tipoEmbarque !== "LCL") return;
    if (tarifaId) return; // FCL/tarifa vinculada ya se encarga.
    if (precargadaLclRef.current) return;
    if (filas.length > 0) { precargadaLclRef.current = true; return; }
    const consolidador = proveedores.find(p => p.id === lclFleteManual?.consolidadorId);
    const nuevas = buildCostosLCLManual({
      lclFleteManual,
      dimensiones: dimensionesLCL,
      pesoKg,
      consolidadorNombre: consolidador?.nombre ?? null,
      markup, // B-075: mismo markup configurable que la rama FCL.
    });
    if (nuevas.length === 0) return;
    setFilas(prev => (prev.length > 0 ? prev : nuevas));
    precargadaLclRef.current = true;
    setLclAutoCargado(true);
  }, [tipoEmbarque, tarifaId, filas.length, lclFleteManual, dimensionesLCL, pesoKg, proveedores, markup, setFilas]);




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
      {mostrarAvisoLclFcl && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-body text-foreground">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>
            La tarifa vinculada está capturada para contenedor (<strong>{tarifa?.tipo_contenedor_nombre}</strong>), pero esta cotización es <strong>LCL</strong>.
            Los costos se precargan en <strong>m³</strong>; revisa cantidades y unidades antes de continuar.
          </span>
        </div>
      )}
      {tarifa && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-body">
          <Link2 className="size-4 text-primary" />
          <span>
            Costos precargados desde tarifa <strong>{tarifa.naviera_nombre}</strong> ({tarifa.puerto_origen_nombre} → {tarifa.puerto_destino_nombre}).
            Puedes editar, agregar o eliminar conceptos.
          </span>
        </div>
      )}
      {lclAutoCargado && !tarifa && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-body">
          <Link2 className="size-4 text-primary" />
          <span>
            Flete LCL precargado desde el Paso 1 (captura manual). Puedes editar, agregar o eliminar conceptos.
          </span>
        </div>
      )}

      <TablaCostosLocal
        filas={filas} filasMoneda={filasUSD} moneda="USD"
        title="Costos en USD" icon={<DollarSign className="h-4 w-4 text-primary" />}
        totales={totalesUSD} onUpdate={updateFila} onAdd={addFila} onRemove={removeFila}
      />
      <TablaCostosLocal
        filas={filas} filasMoneda={filasMXN} moneda="MXN"
        title="Costos en MXN" icon={<Banknote className="h-4 w-4 text-primary" />}
        totales={totalesMXN} onUpdate={updateFila} onAdd={addFila} onRemove={removeFila}
      />
      <ResumenPL
        totalesUSD={totalesUSD} totalesMXN={totalesMXN}
        tieneUSD={filasUSD.length > 0} tieneMXN={filasMXN.length > 0}
        mostrarRentabilidadGlobal
        notaPie="El IVA no forma parte del profit" 
      />
    </div>
  );
}


