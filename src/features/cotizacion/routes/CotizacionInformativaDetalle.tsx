/**
 * Vista de detalle para cotizaciones informativas (tarifarios).
 * Render dedicado: no muestra costos/utilidad ni botones de conversión a embarque.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";
import { PageContainer } from "@/components/shared/PageContainer";
import { formatDate, formatCurrency } from "@/lib/formatters";
import type { CotizacionRow } from "@/features/cotizacion/types";
import { parseTarifasInformativas } from "@/features/cotizacion/services";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { resolveTipoContenedorNombre } from "@/features/cotizacion/utils/resolveTipoContenedorNombre";

import { notifyError } from "@/lib/ui/appFeedback";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  cotizacion: CotizacionRow;
}

async function descargarTarifario(cotizacion: CotizacionRow) {
  const [{ TarifarioDocument }, { descargarPdf }, { cargarEmisorEmpresa }, { slugifyOrg }] = await Promise.all([
    import("@/pdf/documents/TarifarioDocument"),
    import("@/pdf/render/descargarPdf"),
    import("@/pdf/emisor"),
    import("@/lib/filenames"),
  ]);
  const emisor = await cargarEmisorEmpresa();
  await descargarPdf(
    <TarifarioDocument cotizacion={cotizacion} emisor={emisor} />,
    `${slugifyOrg(emisor.razonSocial)}_tarifario-${cotizacion.folio}`,
  );
}

export default function CotizacionInformativaDetalle({ cotizacion }: Props) {
  const volver = useVolver("/cotizaciones");
  const tarifas = parseTarifasInformativas(cotizacion.tarifas_informativas);
  const { data: tiposContenedor = [] } = useTiposContenedor();

  const handleDescargar = async () => {
    try { await descargarTarifario(cotizacion); }
    catch (e) {
      const msg = e instanceof Error ? e.message : "Error al generar PDF";
      notifyError(undefined, { title: msg, error: e, method: "PAGES_COTIZACIONES_COTIZACIONINFORMATIVADETALLE_1" });
    }
  };

  return (
    <PageContainer>
      <DetailHeader
        backTo={volver}
        backLabel="Volver a Cotizaciones"
        title={`Tarifario ${cotizacion.folio}`}
        subtitle={`Cliente: ${cotizacion.cliente_nombre}`}
        trailing={
          <Button onClick={handleDescargar}>
            <Download className="h-4 w-4 mr-2" /> Exportar PDF
          </Button>
        }
      />


      <Card>
        <CardHeader><CardTitle>Vigencia</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-body">
          <div>
            <p className="text-muted-foreground">Desde</p>
            <p className="font-medium">{cotizacion.vigencia_desde ? formatDate(cotizacion.vigencia_desde) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Hasta</p>
            <p className="font-medium">{cotizacion.vigencia_hasta ? formatDate(cotizacion.vigencia_hasta) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ejecutivo</p>
            <p className="font-medium">{cotizacion.operador}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Estado</p>
            <p className="font-medium">{cotizacion.estado}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tarifas ({tarifas.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table className="w-full text-body">
            <TableHeader className="bg-muted/50">
              <TableRow className="text-left">
                <DetailTableHead>Modo</DetailTableHead>
                <DetailTableHead>Modalidad/Equipo</DetailTableHead>
                <DetailTableHead>Ruta</DetailTableHead>
                <DetailTableHead>Unidad</DetailTableHead>
                <DetailTableHead className="text-right">Precio</DetailTableHead>
                <DetailTableHead>Notas</DetailTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tarifas.map((t, i) => {
                const ruta = t.modo === "Terrestre" && t.modalidad_equipo === "Porta Contenedor" && t.punto_intermedio
                  ? `${t.origen} → ${t.punto_intermedio} → ${t.destino}`
                  : `${t.origen} → ${t.destino}`;
                return (
                  <TableRow key={t.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <TableCell>{t.modo}</TableCell>
                    <TableCell>{t.modalidad_equipo || resolveTipoContenedorNombre(t.tipo_contenedor, tiposContenedor)}</TableCell>
                    <TableCell>{ruta}</TableCell>
                    <TableCell>{t.unidad_medida}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(t.precio, t.moneda)}</TableCell>
                    <TableCell className="text-muted-foreground">{t.notas || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {cotizacion.notas && (
        <Card>
          <CardHeader><CardTitle>Notas y condiciones</CardTitle></CardHeader>
          <CardContent><p className="text-body whitespace-pre-wrap">{cotizacion.notas}</p></CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
