import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { actualizarVentaVinculada } from "@/features/cotizacion/domain/sincronizarVentasConCostos";
import { buildConceptosFromCostos } from "@/features/cotizacion/domain/cotizacion.conceptos";
import type { ConceptoVentaCotizacion, FilaCostoLocal } from "@/features/cotizacion/types";

type Props = {
  costos: FilaCostoLocal[];
  ventas: ConceptoVentaCotizacion[];
  tasaIva: number;
  onVincular: (costos: FilaCostoLocal[], ventas: ConceptoVentaCotizacion[]) => void;
};
type SeleccionVenta = "nueva" | ConceptoVentaCotizacion;

/** Legacy identity is explicitly chosen by the user, never inferred from amounts or text. */
export function VincularVentasHeredadas({ costos, ventas, tasaIva, onVincular }: Props) {
  // Keep the chosen row itself: currency partitioning can change its array index.
  // Replacing/removing that row invalidates the choice instead of selecting another.
  const [selecciones, setSelecciones] = useState<Record<string, SeleccionVenta>>({});
  const pendientes = costos.filter(c => c.venta_vinculo_pendiente && c.concepto.trim());
  if (!pendientes.length) return null;
  const tieneOrigen = (venta: ConceptoVentaCotizacion) => !!venta.origen_costo_id && costos.some(c => c.origen_venta_id === venta.origen_costo_id);
  function valorSeleccion(costo: FilaCostoLocal) {
    const seleccion = selecciones[costo.origen_venta_id!];
    if (seleccion === "nueva") return seleccion;
    if (!seleccion || !ventas.includes(seleccion) || tieneOrigen(seleccion)
      || seleccion.moneda !== costo.moneda || !seleccion.descripcion.trim()) return "";
    return String(ventas.indexOf(seleccion));
  }
  function aplicar(costo: FilaCostoLocal) {
    const id = costo.origen_venta_id!;
    const seleccion = selecciones[id];
    if (!valorSeleccion(costo)) return;
    let nuevas: ConceptoVentaCotizacion[];
    if (seleccion === "nueva") {
      const generada = buildConceptosFromCostos([costo], tasaIva);
      nuevas = [...ventas, ...generada.usd, ...generada.mxn];
    } else {
      nuevas = ventas.map(v => v === seleccion ? actualizarVentaVinculada(v, costo, tasaIva) : v);
    }
    onVincular(costos.map(c => c.origen_venta_id === id ? { ...c, venta_vinculo_pendiente: false } : c), nuevas);
  }
  return <Alert variant="warning">
    <AlertTitle>Revisa las ventas sin vínculo a costos</AlertTitle>
    <AlertDescription className="space-y-3">
      <p>Conservamos tus conceptos e impuestos actuales. Estas partidas antiguas no tienen un vínculo verificable: elige qué venta actualizar o agrega una nueva. Ninguna venta se elimina.</p>
      {pendientes.map(c => <div key={c.origen_venta_id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-center">
        <span>{c.concepto}: {c.cantidad} × {formatCurrency(c.precio_venta, c.moneda)}</span>
        <Select value={valorSeleccion(c)} onValueChange={v => {
          const seleccion = v === "nueva" ? v : ventas[Number(v)];
          if (seleccion) setSelecciones(prev => ({ ...prev, [c.origen_venta_id!]: seleccion }));
        }}>
          <SelectTrigger aria-label={`Venta para ${c.concepto}`}><SelectValue placeholder="Conservar ventas actuales" /></SelectTrigger>
          <SelectContent>
            {ventas.map((v, i) => !tieneOrigen(v) && v.moneda === c.moneda && v.descripcion.trim() ? <SelectItem key={i} value={String(i)}>{v.descripcion} · {v.cantidad} × {formatCurrency(v.precio_unitario, v.moneda)} → {c.cantidad} × {formatCurrency(c.precio_venta, c.moneda)} (conserva impuestos)</SelectItem> : null)}
            <SelectItem value="nueva">Agregar otra venta desde este costo</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!valorSeleccion(c)} onClick={() => aplicar(c)}>Aplicar vínculo</Button>
      </div>)}
    </AlertDescription>
  </Alert>;
}
