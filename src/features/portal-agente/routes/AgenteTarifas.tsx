/**
 * Listado de tarifas del agente. Permite crear, editar (sólo borradores/rechazadas)
 * y duplicar (cualquier estado). La aprobación a 'vigente' la hace operaciones.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAgenteTarifas } from "@/features/portal-agente/hooks";
import { AgenteTarifaForm } from "@/features/portal-agente/components/AgenteTarifaForm";
import { Plus, MoreHorizontal } from "lucide-react";
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import type { AgenteTarifaRow } from "@/features/portal-agente/services";

type Filter = "todas" | "borrador" | "vigente" | "rechazada";

interface EditorState {
  open: boolean;
  modo: "crear" | "editar" | "duplicar";
  tarifaId?: string;
  initial?: Partial<TarifaInput>;
}

function toInitial(t: AgenteTarifaRow): Partial<TarifaInput> {
  return {
    agente_id: "", // se rellena con agenteIdFijo en el wrapper
    naviera_id: t.naviera_id,
    ruta_id: t.ruta_id,
    tipo_contenedor_id: t.tipo_contenedor_id,
    flete_base: Number(t.flete_base),
    vigente_desde: t.vigente_desde,
    vigente_hasta: t.vigente_hasta,
    dias_libres_demoras: 7,
    recargos: [],
  };
}

export default function AgenteTarifas() {
  const { data: tarifas = [], isLoading } = useAgenteTarifas();
  const [filtro, setFiltro] = useState<Filter>("todas");
  const [editor, setEditor] = useState<EditorState>({ open: false, modo: "crear" });

  const filtradas = useMemo(
    () => filtro === "todas" ? tarifas : tarifas.filter((t) => t.estado_aprobacion === filtro),
    [tarifas, filtro],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mis tarifas marítimas"
        description="Tarifas que has subido para tus rutas marítimas. Las nuevas tarifas quedan en borrador hasta que operaciones las aprueba."
        actions={
          <Button onClick={() => setEditor({ open: true, modo: "crear" })}>
            <Plus className="h-4 w-4 mr-1" /> Nueva tarifa
          </Button>
        }
      />

      <Card className="p-3">
        <p className="text-xs text-muted-foreground">
          <strong>¿Cómo funciona?</strong> Captura o actualiza una tarifa y queda en <em>borrador</em>.
          Operaciones la revisa y la pasa a <em>vigente</em> — entonces aparece como opción en las
          cotizaciones que envían los vendedores. Si la <em>rechazan</em>, edítala y vuelve a guardarla.
          Las tarifas <em>vigentes</em> no se pueden editar: usa <strong>Duplicar</strong> para crear una versión nueva.
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
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && filtradas.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                No hay tarifas para este filtro.
              </TableCell></TableRow>
            )}
            {filtradas.map((t) => {
              const editable = t.estado_aprobacion === "borrador" || t.estado_aprobacion === "rechazada";
              return (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">
                    {t.puerto_origen_nombre} → {t.puerto_destino_nombre}
                    {t.estado_aprobacion === "rechazada" && t.motivo_rechazo && (
                      <p className="text-xs text-destructive mt-1">
                        <strong>Motivo:</strong> {t.motivo_rechazo}
                      </p>
                    )}
                  </TableCell>
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={!editable}
                          onClick={() => setEditor({ open: true, modo: "editar", tarifaId: t.id, initial: toInitial(t) })}
                        >
                          {t.estado_aprobacion === "rechazada" ? "Corregir y reenviar" : "Editar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setEditor({ open: true, modo: "duplicar", initial: toInitial(t) })}
                        >
                          Duplicar como nueva
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <AgenteTarifaForm
        open={editor.open}
        onOpenChange={(o) => setEditor((s) => ({ ...s, open: o }))}
        modo={editor.modo}
        tarifaId={editor.tarifaId}
        initial={editor.initial}
      />
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "vigente") return <Badge className="bg-success text-success-foreground">Vigente</Badge>;
  if (estado === "borrador") return <Badge className="bg-warning text-warning-foreground">Borrador</Badge>;
  if (estado === "rechazada") return <Badge variant="destructive">Rechazada</Badge>;
  return <Badge variant="outline">{estado}</Badge>;
}
