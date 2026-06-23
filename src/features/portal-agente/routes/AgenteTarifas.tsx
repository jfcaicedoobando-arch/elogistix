/**
 * Listado de tarifas del agente. v1 sólo lectura + indicadores de estado;
 * la captura/edición de tarifas vendrá en una iteración posterior reutilizando
 * `TarifaForm` (requiere adaptarlo al contexto del portal).
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAgenteTarifas } from "@/features/portal-agente/hooks";

type Filter = "todas" | "borrador" | "vigente" | "rechazada";

export default function AgenteTarifas() {
  const { data: tarifas = [], isLoading } = useAgenteTarifas();
  const [filtro, setFiltro] = useState<Filter>("todas");

  const filtradas = useMemo(
    () => filtro === "todas" ? tarifas : tarifas.filter((t) => t.estado_aprobacion === filtro),
    [tarifas, filtro],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mis tarifas marítimas"
        description="Tarifas que has subido para tus rutas marítimas. Las nuevas tarifas quedan en borrador hasta que operaciones las aprueba."
      />

      <Card className="p-3">
        <p className="text-xs text-muted-foreground">
          <strong>¿Cómo funciona?</strong> Captura o actualiza una tarifa y queda en <em>borrador</em>.
          Operaciones la revisa y la pasa a <em>vigente</em> — entonces aparece como opción en las
          cotizaciones que envían los vendedores. Si la <em>rechazan</em>, edítala y vuelve a guardarla.
        </p>
      </Card>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filter)}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({tarifas.length})</TabsTrigger>
          <TabsTrigger value="borrador">Borrador ({tarifas.filter((t) => t.estado_aprobacion === "borrador").length})</TabsTrigger>
          <TabsTrigger value="vigente">Vigente ({tarifas.filter((t) => t.estado_aprobacion === "vigente").length})</TabsTrigger>
          <TabsTrigger value="rechazada">Rechazada ({tarifas.filter((t) => t.estado_aprobacion === "rechazada").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ruta</TableHead>
              <TableHead>Naviera</TableHead>
              <TableHead>Contenedor</TableHead>
              <TableHead className="text-right">Flete base</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && filtradas.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                No hay tarifas para este filtro.
              </TableCell></TableRow>
            )}
            {filtradas.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm">{t.puerto_origen_nombre} → {t.puerto_destino_nombre}</TableCell>
                <TableCell>{t.naviera_nombre}</TableCell>
                <TableCell>{t.tipo_contenedor_nombre}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.moneda} {Number(t.flete_base).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t.vigente_desde} → {t.vigente_hasta}
                </TableCell>
                <TableCell>
                  <EstadoBadge estado={t.estado_aprobacion} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "vigente") return <Badge className="bg-success text-success-foreground">Vigente</Badge>;
  if (estado === "borrador") return <Badge className="bg-warning text-warning-foreground">Borrador</Badge>;
  if (estado === "rechazada") return <Badge variant="destructive">Rechazada</Badge>;
  return <Badge variant="outline">{estado}</Badge>;
}
