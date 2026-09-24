/**
 * Fila detallada de costos por proveedor para el tab Costos del embarque.
 * Muestra: concepto, monto cotizado, facturado, chip narrativo de ajuste,
 * factura(s) ligadas y estado de pago.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { formatCurrency, toTitleCase } from "@/lib/formatters";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";
import {
  calcularSubtotales,
  estatusBadgeClass,
  estatusLabel,
  ordenarFilasPorAjuste,
  pagoBadgeClass,
  peorEstadoPago,
} from "./grupoCostosProveedorHelpers";
import { describirAjuste, describirAjusteNeto } from "./ajusteDescripcion";
import { AjusteChip } from "./AjusteChip";
import { GrupoCostosFacturasCell } from "./GrupoCostosFacturasCell";
import { GrupoCostosProveedorVinculo } from "./GrupoCostosProveedorVinculo";
import { Hint } from "@/components/shared/Hint";
import { GrupoCostosMobileRows } from "./GrupoCostosMobileRows";
import { GrupoCostosProveedorResumen } from "./GrupoCostosProveedorResumen";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  proveedorNombre: string;
  filas: FilaReconciliacion[];
  showContenedorCol?: boolean;
  renderContenedor?: (id: string | null | undefined) => React.ReactNode;
  filaContenedorId?: (fila: FilaReconciliacion) => string | null | undefined;
  /** P1-2 — false = nombre libre sin proveedor del catálogo (sin UUID). */
  vinculadoACatalogo?: boolean;
  /** P1-2 — acción existente para vincular el costo al catálogo. */
  onVincularProveedor?: () => void;
}


export function GrupoCostosProveedor({
  proveedorNombre,
  filas,
  showContenedorCol,
  renderContenedor,
  filaContenedorId,
  vinculadoACatalogo = true,
  onVincularProveedor,
}: Props) {
  const [abierto, setAbierto] = useState(true);
  const subtotales = useMemo(() => calcularSubtotales(filas), [filas]);
  const filasOrdenadas = useMemo(() => ordenarFilasPorAjuste(filas), [filas]);

  const conteos = useMemo(() => {
    let conAjuste = 0, sinFactura = 0;
    for (const f of filas) {
      if (f.facturas.length === 0) sinFactura++;
      else if ((f.vinculos_excluidos ?? 0) > 0) continue;
      else if (Math.abs(f.diferencia) >= 0.01) conAjuste++;
    }
    return { conAjuste, sinFactura };
  }, [filas]);

  // B-057: el resumen narrativo del grupo debe usar el cotizado
  // "facturable" (excluyendo filas sin factura) para no reportar ahorros
  // ficticios cuando el proveedor aún no ha facturado.
  const resumenNarrativo = subtotales.map(s => ({
    moneda: s.moneda,
    d: describirAjusteNeto(s.cotizadoFacturable, s.facturadoFacturable, s.moneda),
  }));

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 text-left"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
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
        <GrupoCostosProveedorResumen
          resumen={resumenNarrativo}
          subtotales={subtotales}
          conAjuste={conteos.conAjuste}
          sinFactura={conteos.sinFactura}
        />
      </button>

      {!vinculadoACatalogo && proveedorNombre !== "Sin proveedor" && (
        <GrupoCostosProveedorVinculo
          proveedorNombre={proveedorNombre}
          onVincular={onVincularProveedor}
        />
      )}



      {abierto && (
        <>
        <GrupoCostosMobileRows
          filas={filasOrdenadas}
          showContenedorCol={showContenedorCol}
          renderContenedor={renderContenedor}
          filaContenedorId={filaContenedorId}
        />
        <div className="hidden overflow-x-auto md:block">
          {/* v13.823.336 (HD 1280×720): anchos mínimos + concepto fijo para
              que Estado y Pago no queden fuera de la vista. */}
          <Table className="w-full min-w-[900px] text-body">
            <TableHeader className="bg-background border-b">
              <TableRow className="text-body-sm text-muted-foreground">
                <DetailTableHead className="sticky left-0 z-10 bg-background min-w-[200px]">Concepto</DetailTableHead>
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
                  pendienteTc: (f.vinculos_excluidos ?? 0) > 0,
                });
                const pago = peorEstadoPago(f.facturas);
                return (
                  <TableRow key={f.concepto_costo_id} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                    <TableCell
                      // Fondo opaco: la columna fija no puede dejar ver el
                      // contenido que pasa por debajo al desplazar.
                      className="sticky left-0 z-10 min-w-[200px] bg-card"
                    >
                      {f.concepto}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(f.cotizado, f.moneda)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.real_facturado > 0 ? formatCurrency(f.real_facturado, f.moneda) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <AjusteChip descripcion={ajuste} />
                    </TableCell>
                    <TableCell>
                      <GrupoCostosFacturasCell fila={f} />
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
        </>
      )}
    </div>
  );
}
