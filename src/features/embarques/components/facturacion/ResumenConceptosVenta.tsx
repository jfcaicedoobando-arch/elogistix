import { useCallback, useMemo } from "react";
import { FileSpreadsheet, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA, resolverTasaConcepto, sumarSubtotales, sumarMontos } from "@/lib/financial/financialUtils";
import { GrupoConceptosContenedor } from "./GrupoConceptosContenedor";
import { ResumenConceptosVentaTotales } from "./ResumenConceptosVentaTotales";
import { EstadoConceptoBadge, type EstadoConcepto } from "./estadoConceptoBadge";
import { agruparPorContenedor } from "@/lib/domain/conceptosPorContenedor";
import type { Tables } from "@/types/db";
import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";

type ConceptoVenta = Tables<"conceptos_venta">;

interface Props {
  conceptos: ConceptoVenta[];
  contenedores: EmbarqueContenedor[];
  tasaIva: number;
  canEdit: boolean;
  /** Mapa concepto.id → estado tri-valor calculado por TabFacturacion. */
  estadosConceptos: Map<string, EstadoConcepto>;
  /** Abre el diálogo con filtro 'todos'. */
  onGenerarProforma: () => void;
  /** v12.14.0: abre el diálogo con filtro fijado a un contenedor concreto. */
  onGenerarProformaContenedor?: (contenedorId: string) => void;
}

export function ResumenConceptosVenta({
  conceptos, contenedores, tasaIva, canEdit, estadosConceptos,
  onGenerarProforma, onGenerarProformaContenedor,
}: Props) {
  const estadoDe = useCallback(
    (id: string): EstadoConcepto => estadosConceptos.get(id) ?? "pendiente",
    [estadosConceptos],
  );
  const conceptosPendientes = useMemo(
    () => conceptos.filter(c => estadoDe(c.id) === "pendiente"),
    [conceptos, estadoDe]
  );
  const conceptosEnProforma = useMemo(
    () => conceptos.filter(c => estadoDe(c.id) === "en_proforma"),
    [conceptos, estadoDe]
  );
  const conceptosFacturados = useMemo(
    () => conceptos.filter(c => estadoDe(c.id) === "facturado"),
    [conceptos, estadoDe]
  );

  // v12.14.0: si hay ≥2 contenedores reales mostramos vista agrupada
  const contenedoresActivos = useMemo(
    () => contenedores.filter((c) => !c.deleted_at),
    [contenedores],
  );
  const multiContenedor = contenedoresActivos.length >= 2;

  const agrupacion = useMemo(() => {
    if (!multiContenedor) return null;
    return agruparPorContenedor(conceptos, contenedoresActivos.map((c) => c.id));
  }, [conceptos, contenedoresActivos, multiContenedor]);

  const totales = useMemo(() => {
    const getter = (c: ConceptoVenta) => ({ cantidad: Number(c.cantidad), precioUnitario: Number(c.precio_unitario) });
    const sumByCurrency = (items: ConceptoVenta[]) => {
      const usd = items.filter(c => c.moneda === "USD");
      const mxn = items.filter(c => c.moneda === "MXN");
      const subUsd = sumarSubtotales(usd, getter);
      const ivaUsd = sumarMontos(
        usd.map((c) => (c.aplica_iva
          ? calcularIVA(Number(c.cantidad) * Number(c.precio_unitario), resolverTasaConcepto(c, tasaIva))
          : 0)),
      );
      const subMxn = sumarSubtotales(mxn, getter);
      const ivaMxn = sumarMontos(
        mxn.map((c) => calcularIVA(Number(c.cantidad) * Number(c.precio_unitario), resolverTasaConcepto(c, tasaIva))),
      );
      return { totalUsd: subUsd + ivaUsd, totalMxn: subMxn + ivaMxn };
    };
    return {
      pendiente: sumByCurrency(conceptosPendientes),
      enProforma: sumByCurrency(conceptosEnProforma),
      facturado: sumByCurrency(conceptosFacturados),
    };
  }, [conceptosPendientes, conceptosEnProforma, conceptosFacturados, tasaIva]);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Conceptos de Venta
          {multiContenedor && (
            <Badge variant="outline" className="ml-1 text-2xs">
              {contenedoresActivos.length} contenedores
            </Badge>
          )}
        </CardTitle>
        {canEdit && conceptosPendientes.length > 0 && (
          <Button size="sm" onClick={onGenerarProforma}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Generar Proforma
            <Badge variant="secondary" className="ml-2 bg-primary-foreground/20 text-primary-foreground border-0">
              {conceptosPendientes.length}
            </Badge>
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {conceptos.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay conceptos de venta registrados. Agrega conceptos en la pestaña Costos.
            </p>
          </div>
        ) : (
          <>
            {multiContenedor && agrupacion ? (
              <>
                {contenedoresActivos.map((cont) => {
                  const items = agrupacion.porContenedor[cont.id] ?? [];
                  if (items.length === 0) return null;
                  const pendientes = items.filter((c) => estadoDe(c.id) === "pendiente").length;
                  const numero = cont.numero_contenedor?.trim() || `#${cont.orden}`;
                  return (
                    <GrupoConceptosContenedor
                      key={cont.id}
                      titulo={`Contenedor ${numero}`}
                      subtitulo={cont.tipo_contenedor || undefined}
                      conceptos={items}
                      canEdit={canEdit}
                      pendientesCount={pendientes}
                      estadosConceptos={estadosConceptos}
                      onGenerar={onGenerarProformaContenedor ? () => onGenerarProformaContenedor(cont.id) : null}
                    />
                  );
                })}
                {agrupacion.generales.length > 0 && (
                  <GrupoConceptosContenedor
                    titulo="Cargos generales del BL"
                    subtitulo="Aplican a todo el embarque"
                    conceptos={agrupacion.generales}
                    canEdit={canEdit}
                    pendientesCount={agrupacion.generales.filter((c) => estadoDe(c.id) === "pendiente").length}
                    estadosConceptos={estadosConceptos}
                    onGenerar={onGenerarProformaContenedor ? () => onGenerarProformaContenedor("generales") : null}
                  />
                )}
              </>
            ) : (
              <DataTable<ConceptoVenta>
                columns={defineColumns<ConceptoVenta>([
                  {
                    id: "descripcion", header: "Descripción", meta: { className: "font-medium" },
                    cell: ({ row }) => {
                      const c = row.original;
                      return (
                        <>
                          {c.descripcion}
                          {c.moneda === "USD" && c.aplica_iva && (
                            <Badge variant="warning" className="ml-2 text-xs">+IVA</Badge>
                          )}
                        </>
                      );
                    },
                  },
                  { id: "cant", header: "Cantidad", meta: { className: "text-right tabular-nums", headerClassName: "text-right" }, cell: ({ row }) => row.original.cantidad },
                  { id: "pu", header: "P. Unitario", meta: { className: "text-right tabular-nums", headerClassName: "text-right" }, cell: ({ row }) => formatCurrency(Number(row.original.precio_unitario), row.original.moneda) },
                  { id: "total", header: "Total", meta: { className: "text-right font-semibold tabular-nums", headerClassName: "text-right" },
                    cell: ({ row }) => formatCurrency(Number(row.original.cantidad) * Number(row.original.precio_unitario), row.original.moneda) },
                  { id: "moneda", header: "Moneda", cell: ({ row }) => row.original.moneda },
                  {
                    id: "estado", header: "Estado",
                    cell: ({ row }) => <EstadoConceptoBadge estado={estadoDe(row.original.id)} />,
                  },
                ]) as ColumnDef<ConceptoVenta, unknown>[]}
                data={conceptos}
                rowKey={(c) => c.id}
                density="compact"
              />
            )}

            <ResumenConceptosVentaTotales
              totales={totales}
              pendientesCount={conceptosPendientes.length}
              enProformaCount={conceptosEnProforma.length}
              facturadosCount={conceptosFacturados.length}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
