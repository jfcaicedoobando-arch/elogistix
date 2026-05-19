import { useMemo } from "react";
import { CheckCircle2, Clock, FileText, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA } from "@/lib/financial/financialUtils";
import type { Tables } from "@/types/db";

type ConceptoVenta = Tables<"conceptos_venta">;

interface Props {
  conceptos: ConceptoVenta[];
  tasaIva: number;
  canEdit: boolean;
  onGenerarProforma: () => void;
}

export function ResumenConceptosVenta({ conceptos, tasaIva, canEdit, onGenerarProforma }: Props) {
  const conceptosPendientes = useMemo(
    () => conceptos.filter(c => c.estado_facturacion !== "en_proforma"),
    [conceptos]
  );
  const conceptosEnProforma = useMemo(
    () => conceptos.filter(c => c.estado_facturacion === "en_proforma"),
    [conceptos]
  );

  const totales = useMemo(() => {
    const sumByCurrency = (items: ConceptoVenta[]) => {
      const usd = items.filter(c => c.moneda === "USD");
      const mxn = items.filter(c => c.moneda === "MXN");
      const subUsd = usd.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
      const ivaUsd = usd.reduce((s, c) => {
        const sub = Number(c.cantidad) * Number(c.precio_unitario);
        return c.aplica_iva ? s + calcularIVA(sub, tasaIva) : s;
      }, 0);
      const subMxn = mxn.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
      const ivaMxn = calcularIVA(subMxn, tasaIva);
      return { totalUsd: subUsd + ivaUsd, totalMxn: subMxn + ivaMxn };
    };
    return {
      pendiente: sumByCurrency(conceptosPendientes),
      enProforma: sumByCurrency(conceptosEnProforma),
    };
  }, [conceptosPendientes, conceptosEnProforma, tasaIva]);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Conceptos de Venta
        </CardTitle>
        {canEdit && conceptosPendientes.length > 0 && (
          <Button size="sm" onClick={onGenerarProforma}>
            <FileText className="h-4 w-4 mr-1" /> Generar Proforma
            <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-0">
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
            <DataTable<ConceptoVenta>
              columns={[
                {
                  key: "descripcion", header: "Descripción", className: "font-medium",
                  render: (c) => (
                    <>
                      {c.descripcion}
                      {c.moneda === "USD" && c.aplica_iva && (
                        <Badge variant="warning" className="ml-2 text-xs">+IVA</Badge>
                      )}
                    </>
                  ),
                },
                { key: "cant", header: "Cantidad", align: "right", className: "tabular-nums", render: (c) => c.cantidad },
                { key: "pu", header: "P. Unitario", align: "right", className: "tabular-nums", render: (c) => formatCurrency(Number(c.precio_unitario), c.moneda) },
                { key: "total", header: "Total", align: "right", className: "font-semibold tabular-nums",
                  render: (c) => formatCurrency(Number(c.cantidad) * Number(c.precio_unitario), c.moneda) },
                { key: "moneda", header: "Moneda", render: (c) => c.moneda },
                {
                  key: "estado", header: "Estado",
                  render: (c) => c.estado_facturacion === "en_proforma" ? (
                    <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" /> En proforma</Badge>
                  ) : (
                    <Badge variant="neutral"><Clock className="h-3 w-3 mr-1" /> Pendiente</Badge>
                  ),
                },
              ]}
              data={conceptos}
              rowKey={(c) => c.id}
              density="compact"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-t bg-muted/30">
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-semibold">Pendiente</span>
                  <Badge variant="secondary" className="ml-auto">{conceptosPendientes.length}</Badge>
                </div>
                <div className="text-sm space-y-0.5">
                  {totales.pendiente.totalMxn > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">MXN:</span><span className="font-semibold">{formatCurrency(totales.pendiente.totalMxn, "MXN")}</span></div>
                  )}
                  {totales.pendiente.totalUsd > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">USD:</span><span className="font-semibold">{formatCurrency(totales.pendiente.totalUsd, "USD")}</span></div>
                  )}
                  {totales.pendiente.totalMxn === 0 && totales.pendiente.totalUsd === 0 && (
                    <span className="text-muted-foreground text-xs">Sin conceptos pendientes</span>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-success/30 bg-success/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold">En proforma</span>
                  <Badge className="ml-auto bg-success/15 text-success border-success/30">{conceptosEnProforma.length}</Badge>
                </div>
                <div className="text-sm space-y-0.5">
                  {totales.enProforma.totalMxn > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">MXN:</span><span className="font-semibold">{formatCurrency(totales.enProforma.totalMxn, "MXN")}</span></div>
                  )}
                  {totales.enProforma.totalUsd > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">USD:</span><span className="font-semibold">{formatCurrency(totales.enProforma.totalUsd, "USD")}</span></div>
                  )}
                  {totales.enProforma.totalMxn === 0 && totales.enProforma.totalUsd === 0 && (
                    <span className="text-muted-foreground text-xs">Sin proformas generadas</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
