/**
 * Fila detallada de costos por proveedor para el tab Costos del embarque.
 * Muestra: concepto, monto cotizado, facturado (Δ), factura(s) ligadas y estado de pago.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, toTitleCase } from "@/lib/formatters";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { FilaReconciliacion, FacturaVinculada } from "@/features/embarques/services/reconciliacionCostos";

interface Props {
  proveedorNombre: string;
  filas: FilaReconciliacion[];
  showContenedorCol?: boolean;
  renderContenedor?: (id: string | null | undefined) => React.ReactNode;
  filaContenedorId?: (fila: FilaReconciliacion) => string | null | undefined;
}

type SubtotalPorMoneda = {
  moneda: string;
  cotizado: number;
  facturado: number;
};

function calcularSubtotales(filas: FilaReconciliacion[]): SubtotalPorMoneda[] {
  const map = new Map<string, SubtotalPorMoneda>();
  for (const f of filas) {
    const cur = map.get(f.moneda) ?? { moneda: f.moneda, cotizado: 0, facturado: 0 };
    cur.cotizado += f.cotizado;
    cur.facturado += f.real_facturado;
    map.set(f.moneda, cur);
  }
  return Array.from(map.values());
}

function estatusBadgeClass(estatus: FilaReconciliacion["estatus_renglon"]): string {
  switch (estatus) {
    case "conciliado": return "bg-success/15 text-success border-success/30";
    case "parcial": return "bg-warning/15 text-warning border-warning/30";
    case "excedente": return "bg-destructive/15 text-destructive border-destructive/30";
    case "sin_match":
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function estatusLabel(estatus: FilaReconciliacion["estatus_renglon"]): string {
  switch (estatus) {
    case "conciliado": return "Conciliado";
    case "parcial": return "Parcial";
    case "excedente": return "Excedente";
    case "sin_match":
    default: return "Sin factura";
  }
}

function pagoBadgeClass(estado: string | null): string {
  const v = (estado ?? "").toLowerCase();
  if (v === "pagada") return "bg-success/15 text-success border-success/30";
  if (v === "vencida") return "bg-destructive/15 text-destructive border-destructive/30";
  if (v === "vigente") return "bg-warning/15 text-warning border-warning/30";
  return "bg-muted text-muted-foreground border-border";
}

/** Devuelve el "peor" estado de pago cuando hay varias facturas ligadas. */
function peorEstadoPago(facturas: FacturaVinculada[]): string | null {
  if (facturas.length === 0) return null;
  const orden = ["vencida", "vigente", "pagada"];
  let peor: string | null = null;
  for (const f of facturas) {
    const v = (f.estatus_pago ?? "").toLowerCase();
    if (!peor) { peor = v; continue; }
    if (orden.indexOf(v) < orden.indexOf(peor)) peor = v;
  }
  return peor ? peor.charAt(0).toUpperCase() + peor.slice(1) : null;
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "s/f";
  try { return format(new Date(iso), "dd/MM/yyyy", { locale: es }); }
  catch { return iso; }
}

export function GrupoCostosProveedor({
  proveedorNombre,
  filas,
  showContenedorCol,
  renderContenedor,
  filaContenedorId,
}: Props) {
  const [abierto, setAbierto] = useState(true);
  const subtotales = useMemo(() => calcularSubtotales(filas), [filas]);

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {abierto ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <span className="font-medium text-sm truncate" title={proveedorNombre}>{toTitleCase(proveedorNombre)}</span>
          <Badge variant="outline" className="text-xs">{filas.length}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums shrink-0">
          {subtotales.map(s => {
            const dif = s.facturado - s.cotizado;
            const difColor = dif === 0 ? "text-muted-foreground" : dif > 0 ? "text-destructive" : "text-success";
            return (
              <span key={s.moneda} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{s.moneda}</span>
                <span>{formatCurrency(s.cotizado, s.moneda)}</span>
                <span className="text-muted-foreground">→</span>
                <span>{formatCurrency(s.facturado, s.moneda)}</span>
                <span className={difColor}>({dif >= 0 ? "+" : ""}{formatCurrency(dif, s.moneda)})</span>
              </span>
            );
          })}
        </div>
      </button>

      {abierto && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background border-b">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Concepto</th>
                <th className="text-right px-3 py-2 font-medium">Cotizado</th>
                <th className="text-right px-3 py-2 font-medium">Facturado</th>
                <th className="text-right px-3 py-2 font-medium">Δ</th>
                <th className="text-left px-3 py-2 font-medium">Factura(s)</th>
                <th className="text-left px-3 py-2 font-medium">Estado</th>
                <th className="text-left px-3 py-2 font-medium">Pago</th>
                {showContenedorCol && <th className="text-left px-3 py-2 font-medium">Contenedor</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, idx) => {
                const diffColor = f.diferencia === 0
                  ? "text-muted-foreground"
                  : f.diferencia > 0 ? "text-destructive" : "text-success";
                const pago = peorEstadoPago(f.facturas);
                return (
                  <tr key={f.concepto_costo_id} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                    <td className="px-3 py-2">{f.concepto}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(f.cotizado, f.moneda)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {f.real_facturado > 0 ? formatCurrency(f.real_facturado, f.moneda) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${diffColor}`}>
                      {f.facturas.length > 0
                        ? `${f.diferencia >= 0 ? "+" : ""}${formatCurrency(f.diferencia, f.moneda)}`
                        : <span className="text-muted-foreground">—</span>}
                      {f.facturas.length > 0 && Math.abs(f.desviacion_pct) >= 0.1 && (
                        <div className="text-[10px] text-muted-foreground">
                          {f.desviacion_pct >= 0 ? "+" : ""}{f.desviacion_pct.toFixed(1)}%
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {f.facturas.length === 0 ? (
                        <span className="text-muted-foreground text-xs">Sin factura</span>
                      ) : (
                        <TooltipProvider delayDuration={200}>
                          <div className="flex flex-col gap-1">
                            {f.facturas.map(fa => (
                              <Tooltip key={fa.proveedor_factura_id}>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="w-fit gap-1 font-normal text-xs cursor-help">
                                    <FileText className="h-3 w-3" />
                                    {fa.folio_proveedor} · {fmtFecha(fa.fecha_emision)}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  <div className="font-medium">{fa.folio_proveedor}</div>
                                  <div>Monto: {formatCurrency(fa.monto, f.moneda)}</div>
                                  <div>Emisión: {fmtFecha(fa.fecha_emision)}</div>
                                  {fa.fecha_vencimiento && <div>Vencimiento: {fmtFecha(fa.fecha_vencimiento)}</div>}
                                  {fa.estatus_pago && <div>Pago: {fa.estatus_pago}</div>}
                                  {fa.descripcion && <div className="text-muted-foreground max-w-xs">{fa.descripcion}</div>}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </TooltipProvider>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`${estatusBadgeClass(f.estatus_renglon)} text-xs`}>
                        {estatusLabel(f.estatus_renglon)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {pago ? (
                        <Badge variant="outline" className={`${pagoBadgeClass(pago)} text-xs`}>{pago}</Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    {showContenedorCol && (
                      <td className="px-3 py-2 text-xs">
                        {renderContenedor && filaContenedorId ? renderContenedor(filaContenedorId(f)) : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
