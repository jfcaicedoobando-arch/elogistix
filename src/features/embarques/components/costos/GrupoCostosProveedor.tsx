/**
 * Fila detallada de costos por proveedor para el tab Costos del embarque.
 * Muestra: concepto, monto cotizado, facturado, chip narrativo de ajuste,
 * factura(s) ligadas y estado de pago.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, toTitleCase } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";
import {
  calcularSubtotales,
  estatusBadgeClass,
  estatusLabel,
  ordenarFilasPorAjuste,
  pagoBadgeClass,
  peorEstadoPago,
  fmtFecha,
} from "./grupoCostosProveedorHelpers";
import { describirAjuste, describirAjusteNeto } from "./ajusteDescripcion";
import { AjusteChip } from "./AjusteChip";
import { Hint } from "@/components/shared/Hint";
import { TONE_TEXT } from "@/lib/ui/badgeTone";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  proveedorNombre: string;
  filas: FilaReconciliacion[];
  showContenedorCol?: boolean;
  renderContenedor?: (id: string | null | undefined) => React.ReactNode;
  filaContenedorId?: (fila: FilaReconciliacion) => string | null | undefined;
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
  const filasOrdenadas = useMemo(() => ordenarFilasPorAjuste(filas), [filas]);

  const conteos = useMemo(() => {
    let conAjuste = 0, sinFactura = 0;
    for (const f of filas) {
      if (f.facturas.length === 0) sinFactura++;
      else if (Math.abs(f.diferencia) >= 0.01) conAjuste++;
    }
    return { conAjuste, sinFactura };
  }, [filas]);

  // B-057: el resumen narrativo del grupo debe usar el cotizado
  // "facturable" (excluyendo filas sin factura) para no reportar ahorros
  // ficticios cuando el proveedor aún no ha facturado.
  const resumenNarrativo = subtotales.map(s => ({
    moneda: s.moneda,
    d: describirAjusteNeto(s.cotizadoFacturable, s.facturado, s.moneda),
  }));

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {abierto ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <Hint label={proveedorNombre}>
            <span className="font-medium text-body truncate">{toTitleCase(proveedorNombre)}</span>
          </Hint>
          <Badge variant="outline" className="text-body-sm">{filas.length}</Badge>
          {/* v13.509.0 — Avisamos los costos sin proveedor: bloquean el cotejo
              con la factura del proveedor y deben completarse antes de facturar. */}
          {proveedorNombre === "Sin proveedor" && (
            <Badge variant="destructive" className="text-body-sm shrink-0">Asignar proveedor</Badge>
          )}
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-3 text-body-sm tabular-nums shrink-0">
            {resumenNarrativo.map(({ moneda, d }) => (
              <Tooltip key={moneda}>
                <TooltipTrigger asChild>
                  <span className={cn("flex items-center gap-1.5 cursor-help", TONE_TEXT[d.tone])}>
                    <span aria-hidden>{d.icono}</span>
                    <span className="font-medium">{d.titulo === "Sin ajuste" || d.titulo === "Sin factura" ? d.titulo : d.titulo}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{moneda}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-body-sm">
                  <div>Cotizado: {formatCurrency(subtotales.find(x=>x.moneda===moneda)?.cotizado ?? 0, moneda)}</div>
                  <div>Facturado: {formatCurrency(subtotales.find(x=>x.moneda===moneda)?.facturado ?? 0, moneda)}</div>
                  <div className="mt-1">{d.detalle}</div>
                </TooltipContent>
              </Tooltip>
            ))}
            <span className="text-muted-foreground">
              {conteos.conAjuste} con ajuste{conteos.sinFactura > 0 ? `, ${conteos.sinFactura} sin factura` : ""}
            </span>
          </div>
        </TooltipProvider>
      </button>

      {abierto && (
        <div className="overflow-x-auto">
          <Table className="w-full text-body">
            <TableHeader className="bg-background border-b">
              <TableRow className="text-body-sm text-muted-foreground">
                <DetailTableHead>Concepto</DetailTableHead>
                <DetailTableHead className="text-right">Cotizado</DetailTableHead>
                <DetailTableHead className="text-right">Facturado</DetailTableHead>
                <DetailTableHead>Ajuste</DetailTableHead>
                <DetailTableHead>Factura(s)</DetailTableHead>
                <DetailTableHead>Estado</DetailTableHead>
                <DetailTableHead>Pago</DetailTableHead>
                {showContenedorCol && <DetailTableHead>Contenedor</DetailTableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasOrdenadas.map((f, idx) => {
                const ajuste = describirAjuste(f.cotizado, f.real_facturado, f.moneda, {
                  tieneFactura: f.facturas.length > 0,
                });
                const pago = peorEstadoPago(f.facturas);
                return (
                  <TableRow key={f.concepto_costo_id} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                    <TableCell>{f.concepto}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(f.cotizado, f.moneda)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.real_facturado > 0 ? formatCurrency(f.real_facturado, f.moneda) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <AjusteChip descripcion={ajuste} />
                    </TableCell>
                    <TableCell>
                      {f.facturas.length === 0 ? (
                        <span className="text-muted-foreground text-body-sm">Sin factura</span>
                      ) : (
                        <TooltipProvider delayDuration={200}>
                          <div className="flex flex-col gap-1">
                            {f.facturas.map(fa => (
                              <Tooltip key={fa.proveedor_factura_id}>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="w-fit gap-1 font-normal text-body-sm cursor-help">
                                    <FileText className="h-3 w-3" />
                                    {fa.folio_proveedor} · {fmtFecha(fa.fecha_emision)}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="text-body-sm">
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
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${estatusBadgeClass(f.estatus_renglon)} text-body-sm`}>
                        {estatusLabel(f.estatus_renglon)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pago ? (
                        <Badge variant="outline" className={`${pagoBadgeClass(pago)} text-body-sm`}>{pago}</Badge>
                      ) : <span className="text-muted-foreground text-body-sm">—</span>}
                    </TableCell>
                    {showContenedorCol && (
                      <TableCell className="text-body-sm">
                        {renderContenedor && filaContenedorId ? renderContenedor(filaContenedorId(f)) : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
