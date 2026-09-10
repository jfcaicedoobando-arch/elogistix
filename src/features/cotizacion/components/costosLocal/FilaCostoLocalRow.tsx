import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, PenLine, StickyNote } from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { calcularUtilidad, calcularMargen } from "@/lib/financial/financialUtils";
import { ProfitBadge } from "@/features/cotizacion/components/ProfitBadge";
import { ProductoServicioSelect } from "@/features/cotizacion/components/conceptos/ProductoServicioSelect";
import { UnidadMedidaSelect } from "@/features/cotizacion/components/conceptos/UnidadMedidaSelect";
import { tasaDesdeTipoIva } from "@/features/cotizacion/hooks/useProductosCatalogo";
import type { FilaCostoLocal } from "../SeccionCostosInternosPLUnificado";
import { parseCantidad, cantidadFueraDeRango, CANTIDAD_LIMITE_SANIDAD } from "../../utils/parseInputNumero";
import { useNumericField } from "@/features/cotizacion/hooks/useNumericField";
import { filaCostoInvalida } from "@/features/cotizacion/domain/cotizacionVentaSync";
import { COL_COSTO, COSTO_GRID_MIN_W } from "./columnasCosto";
import { cn } from "@/lib/utils";

/** Formato de presentación de los campos de dinero (sin prefijo de moneda). */
const formatoMonto = (n: number) => formatNumber(n, { decimals: 2 });

interface Props {
  fila: FilaCostoLocal;
  gi: number;
  /** Moneda del bloque; se muestra en el título de la sección, no por celda. */
  moneda: "USD" | "MXN";
  onUpdate: (globalIdx: number, field: keyof FilaCostoLocal, value: string | number | boolean) => void;
  onRemove: (globalIdx: number) => void;
}


export function FilaCostoLocalRow({ fila, gi, onUpdate, onRemove }: Props) {
  // R-01: los tres campos comparten el mismo patrón de edición local
  // (string crudo mientras hay foco, commit al salir del campo).
  const cantidadField = useNumericField(fila.cantidad, (n) => onUpdate(gi, "cantidad", n), {
    parse: parseCantidad,
    fallback: 1,
  });
  // v13.823.286 — los campos de dinero se leen con formato al salir del campo
  // (6100 → 6,100.00), igual que las columnas calculadas del mismo renglón.
  const costoField = useNumericField(fila.costo_unitario, (n) => onUpdate(gi, "costo_unitario", n), {
    formatDisplay: formatoMonto,
  });
  const ventaField = useNumericField(fila.precio_venta, (n) => onUpdate(gi, "precio_venta", n), {
    formatDisplay: formatoMonto,
  });
  const cantidadExcedida = cantidadFueraDeRango(fila.cantidad);
  const costoTotal = fila.cantidad * fila.costo_unitario;
  const ventaTotal = fila.cantidad * fila.precio_venta;
  const profit = calcularUtilidad(ventaTotal, costoTotal);
  const pct = calcularMargen(ventaTotal, costoTotal);

  // B-081: renglón con importes y sin concepto → se descartaría al generar la
  // venta y la cotización saldría en $0.00. Se marca y bloquea el avance.
  const conceptoFaltante = filaCostoInvalida(fila);

  // El campo de notas ya no vive abierto en cada renglón (hacía la tabla
  // altísima): se abre a demanda y queda abierto si la fila ya trae notas.
  const [notasAbiertas, setNotasAbiertas] = useState(false);
  // v13.823.286 — cerradas por defecto incluso si ya hay texto: el icono queda
  // resaltado como indicador y la lista deja de crecer de alto.
  const mostrarNotas = notasAbiertas;

  return (
    <div
      className={cn(
        "border-b border-border last:border-b-0 py-2 px-3",
        conceptoFaltante && "bg-destructive/5",
      )}
    >
      <div className={cn("flex items-center gap-2", COSTO_GRID_MIN_W)}>
        <div className={COL_COSTO.concepto}>
          {/* Combobox estricto contra `catalogo_claves_sat` — mismo origen que el paso 3. */}
          <ProductoServicioSelect
            value={fila.concepto}
            onSelect={(p) => {
              onUpdate(gi, "concepto", p.nombre);
              onUpdate(gi, "clave_sat", p.clave_sat);
              onUpdate(gi, "concepto_libre", false);
              onUpdate(gi, "aplica_iva", p.tipo_iva === "gravado_16");
              onUpdate(gi, "tasa_iva_aplicada", tasaDesdeTipoIva(p.tipo_iva));
              // Sólo pre-llena unidad si la fila no tenía una elegida a mano.
              if (p.clave_unidad_sat && !fila.unidad_medida) {
                onUpdate(gi, "unidad_medida", p.clave_unidad_sat);
              }
            }}
            onConceptoLibre={(texto) => {
              // Q-10/Q-12: concepto sin clave SAT — se marca `concepto_libre`
              // para que la fila sea válida sin bloquear el wizard; la clave
              // SAT se pedirá manualmente en el paso de facturación.
              onUpdate(gi, "concepto", texto);
              onUpdate(gi, "clave_sat", "");
              onUpdate(gi, "concepto_libre", true);
            }}
            placeholder="Selecciona concepto"
          />
        </div>

        <Input
          value={fila.proveedor}
          onChange={(e) => onUpdate(gi, "proveedor", e.target.value)}
          className={cn("h-9 text-body", COL_COSTO.proveedor)}
          placeholder="Proveedor"
          aria-label="Proveedor"
          /* El nombre largo se corta en el campo; el valor completo se lee al
             pasar el cursor en vez de ensanchar la columna. */
          title={fila.proveedor || undefined}
        />

        <div className={COL_COSTO.unidad}>
          <UnidadMedidaSelect
            value={fila.unidad_medida}
            onChange={(v) => onUpdate(gi, "unidad_medida", v)}
          />
        </div>

        <Input
          type="text" inputMode="decimal"
          {...cantidadField}
          aria-label="Cantidad"
          aria-invalid={cantidadExcedida}
          className={cn("h-9 text-body text-right", COL_COSTO.cantidad)}
        />
        <Input
          type="text" inputMode="decimal"
          {...costoField}
          aria-label="Costo unitario"
          className={cn("h-9 text-body text-right", COL_COSTO.costoUnitario)}
        />
        <Input
          type="text" inputMode="decimal"
          {...ventaField}
          aria-label="Precio de venta"
          className={cn("h-9 text-body text-right", COL_COSTO.ventaUnitaria)}
        />

        {/* Q-15.9 — importes por partida, bajo su propio encabezado. Sin
            prefijo de moneda: ya está en el título de la sección, y repetirlo
            partía las cifras en dos líneas. */}
        <span className={cn("text-body text-right tabular-nums", COL_COSTO.costoTotal)}>
          {formatNumber(costoTotal, { decimals: 2 })}
        </span>
        <span className={cn("text-body text-right tabular-nums", COL_COSTO.ventaTotal)}>
          {formatNumber(ventaTotal, { decimals: 2 })}
        </span>
        <span
          className={cn(
            "text-body font-medium text-right tabular-nums",
            COL_COSTO.utilidad,
            profit >= 0 ? "text-success" : "text-destructive",
          )}
        >
          {formatNumber(profit, { decimals: 2 })}
        </span>

        <div className={cn("flex justify-center", COL_COSTO.margen)}>
          <ProfitBadge porcentaje={pct} />
        </div>

        <div className={cn("flex items-center justify-end gap-1", COL_COSTO.acciones)}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={mostrarNotas ? "Ocultar notas" : "Agregar notas"}
            aria-expanded={mostrarNotas}
            onClick={() => setNotasAbiertas((v) => !v)}
          >
            <StickyNote className={cn("h-4 w-4", fila.notas ? "text-primary" : "text-muted-foreground")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onRemove(gi)}
            aria-label="Eliminar concepto"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {(fila.concepto_libre || conceptoFaltante || cantidadExcedida) && (
        <div className="mt-1 space-y-0.5">
          {fila.concepto_libre && (
            <p
              className="flex items-center gap-1 text-label text-warning"
              data-testid={`concepto-libre-aviso-${gi}`}
            >
              <PenLine className="h-3 w-3" /> Concepto libre: se pedirá la clave SAT al facturar.
            </p>
          )}
          {conceptoFaltante && (
            <p className="text-label text-destructive" data-testid={`concepto-faltante-aviso-${gi}`}>
              Selecciona el concepto de este renglón; sin nombre no se genera el concepto de venta.
            </p>
          )}
          {cantidadExcedida && (
            <p className="text-label text-destructive">
              Cantidad mayor a {formatNumber(CANTIDAD_LIMITE_SANIDAD)} — verifica el dato.
            </p>
          )}
        </div>
      )}

      {mostrarNotas && (
        <Textarea
          rows={1}
          placeholder="Notas (opcional)"
          value={fila.notas || ""}
          onChange={(e) => onUpdate(gi, "notas", e.target.value)}
          aria-label="Notas del concepto"
          className="mt-2 min-h-9 h-9 py-2 text-body-sm resize-y"
        />
      )}
    </div>
  );
}

