/**
 * Reportes › Cartera y antigüedad (CxC + CxP).
 *
 * Reporte contable con fecha de corte: cubetas de antigüedad, saldo en su
 * moneda y doble valuación en pesos (TC histórico de la factura y TC DOF del
 * corte), exportable a CSV y PDF.
 */
import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, LayoutList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { useDocumentTitle } from "@/hooks/shared";
import { todayLocalISO } from "@/lib/date/today";
import { leyendaTcCorte } from "@/features/reportes/cartera/domain/agingCartera";
import { useCarteraAging } from "@/features/reportes/cartera/hooks/useCarteraAging";
import { CarteraBloque } from "@/features/reportes/cartera/components/CarteraBloque";
import {
  descargarCarteraCsv,
  descargarCarteraPdf,
} from "@/features/reportes/cartera/services/carteraDescargas";

export default function ReportesCartera() {
  useDocumentTitle("Cartera y antigüedad");
  const [fechaCorte, setFechaCorte] = useState<string>(() => todayLocalISO());
  const [busqueda, setBusqueda] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const { tc, cxc, cxp, isLoading, isError, refetch } = useCarteraAging(fechaCorte, busqueda);
  const bloques = useMemo(() => [cxc, cxp], [cxc, cxp]);
  const leyenda = leyendaTcCorte(tc);
  const sinDatos = cxc.filas.length === 0 && cxp.filas.length === 0;

  const exportarPdf = async () => {
    setGenerandoPdf(true);
    try {
      await descargarCarteraPdf(fechaCorte, leyenda, bloques);
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<LayoutList className="h-6 w-6 text-accent" />}
        title="Cartera y antigüedad"
        description="Saldos por cobrar y por pagar con antigüedad y valuación en pesos para uso contable."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => descargarCarteraCsv(fechaCorte, bloques)}
              disabled={sinDatos}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden /> Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void exportarPdf()}
              disabled={sinDatos || generandoPdf}
            >
              {generandoPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FileText className="mr-2 h-4 w-4" aria-hidden />
              )}
              {generandoPdf ? "Generando…" : "Exportar PDF"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1">
            <Label htmlFor="cartera-corte" className="text-xs">Fecha de corte</Label>
            <DatePickerMx
              id="cartera-corte"
              value={fechaCorte}
              onChange={(iso) => setFechaCorte(iso || todayLocalISO())}
              className="w-40"
            />
          </div>
          <div className="min-w-[220px] flex-1 space-y-1">
            <Label htmlFor="cartera-buscar" className="text-xs">Cliente, proveedor, folio o expediente</Label>
            <Input
              id="cartera-buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
            />
          </div>
          <p className="text-xs text-muted-foreground">{leyenda}</p>
        </CardContent>
      </Card>

      <CarteraBloque
        titulo="Cuentas por cobrar"
        etiquetaContraparte="Cliente"
        filas={cxc.filas}
        buckets={cxc.buckets}
        total={cxc.total}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />

      <CarteraBloque
        titulo="Cuentas por pagar"
        etiquetaContraparte="Proveedor"
        filas={cxp.filas}
        buckets={cxp.buckets}
        total={cxp.total}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />
    </PageContainer>
  );
}
