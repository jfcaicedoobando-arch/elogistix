/**
 * Vista de detalle para cotizaciones informativas (tarifarios).
 * Render dedicado: no muestra costos/utilidad ni botones de conversión a embarque.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { formatDate, formatCurrency } from "@/lib/formatters";
import type { CotizacionRow } from "@/features/cotizacion/types";
import { parseTarifasInformativas } from "@/features/cotizacion/services";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { resolveTipoContenedorNombre } from "@/features/cotizacion/utils/resolveTipoContenedorNombre";

import { notifyError } from "@/lib/ui/appFeedback";
interface Props {
  cotizacion: CotizacionRow;
  onBack: () => void;
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

export default function CotizacionInformativaDetalle({ cotizacion, onBack }: Props) {
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
      <PageHeader
        title={`Tarifario ${cotizacion.folio}`}
        description={`Cliente: ${cotizacion.cliente_nombre}`}
        actions={
          <>
            <Button variant="outline" onClick={onBack}>Volver</Button>
            <Button onClick={handleDescargar}>
              <Download className="h-4 w-4 mr-2" /> Descargar PDF
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader><CardTitle>Vigencia</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Modo</th>
                <th className="p-2">Modalidad/Equipo</th>
                <th className="p-2">Ruta</th>
                <th className="p-2">Unidad</th>
                <th className="p-2 text-right">Precio</th>
                <th className="p-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t, i) => {
                const ruta = t.modo === "Terrestre" && t.modalidad_equipo === "Porta Contenedor" && t.punto_intermedio
                  ? `${t.origen} → ${t.punto_intermedio} → ${t.destino}`
                  : `${t.origen} → ${t.destino}`;
                return (
                  <tr key={t.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="p-2">{t.modo}</td>
                    <td className="p-2">{t.modalidad_equipo || resolveTipoContenedorNombre(t.tipo_contenedor, tiposContenedor)}</td>
                    <td className="p-2">{ruta}</td>
                    <td className="p-2">{t.unidad_medida}</td>
                    <td className="p-2 text-right tabular-nums">{formatCurrency(t.precio, t.moneda)}</td>
                    <td className="p-2 text-muted-foreground">{t.notas || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {cotizacion.notas && (
        <Card>
          <CardHeader><CardTitle>Notas y condiciones</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{cotizacion.notas}</p></CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
