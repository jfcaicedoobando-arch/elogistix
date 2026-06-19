/**
 * Página: matriz de tarifas marítimas (alta + lista filtrable).
 */
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Copy, Pencil } from "lucide-react";
import {
  useCosteoTarifas, useCosteoTarifaMutations,
} from "@/features/costeo/hooks/useCosteoTarifas";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { TarifaEstadoBadge } from "@/features/costeo/components/TarifaEstadoBadge";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import { usd, buildInitialFromTarifa, type EstadoFiltro } from "./CosteoTarifas.helpers";
import { PageHeader } from "@/components/shared/PageHeader";

export default function CosteoTarifas() {
  const [estado, setEstado] = useState<EstadoFiltro>("vigente");
  const [agenteId, setAgenteId] = useState<string>("todos");
  const [tipoId, setTipoId] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<Partial<TarifaInput> | undefined>();
  const [editId, setEditId] = useState<string | undefined>();
  const [aEliminar, setAEliminar] = useState<string | null>(null);

  const { data: agentes = [] } = useCosteoAgentes();
  const { data: tipos = [] } = useTiposContenedor();
  const { data: tarifas = [], isLoading } = useCosteoTarifas({
    estado,
    agenteId: agenteId === "todos" ? undefined : agenteId,
    tipoContenedorId: tipoId === "todos" ? undefined : tipoId,
  });
  const { eliminar } = useCosteoTarifaMutations();

  const duplicar = (id: string) => {
    const t = tarifas.find((x) => x.id === id);
    if (!t) return;
    setEditId(undefined);
    setInitial({
      ...buildInitialFromTarifa(t),
      vigente_desde: new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  const editar = (id: string) => {
    const t = tarifas.find((x) => x.id === id);
    if (!t) return;
    setEditId(id);
    setInitial(buildInitialFromTarifa(t));
    setOpen(true);
  };

  const nuevo = () => { setEditId(undefined); setInitial(undefined); setOpen(true); };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Tarifas marítimas (USD)"
        description="Matriz CN → MX por agente, naviera, ruta y tipo de contenedor. El total comparable suma flete + recargos."
        actions={<Button onClick={nuevo}><Plus className="size-4 mr-2" />Nueva tarifa</Button>}
      />

      <Card className="p-4 flex flex-wrap gap-3">
        <div className="min-w-[140px]">
          <Label htmlFor="filtro-estado" className="sr-only">Estado</Label>
          <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
            <SelectTrigger id="filtro-estado" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vigente">Vigentes</SelectItem>
              <SelectItem value="vencida">Vencidas</SelectItem>
              <SelectItem value="reemplazada">Reemplazadas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label htmlFor="filtro-agente" className="sr-only">Agente</Label>
          <Select value={agenteId} onValueChange={setAgenteId}>
            <SelectTrigger id="filtro-agente" aria-label="Filtrar por agente"><SelectValue placeholder="Agente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los agentes</SelectItem>
              {agentes.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <Label htmlFor="filtro-tipo" className="sr-only">Tipo de contenedor</Label>
          <Select value={tipoId} onValueChange={setTipoId}>
            <SelectTrigger id="filtro-tipo" aria-label="Filtrar por tipo de contenedor"><SelectValue placeholder="Contenedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ruta</TableHead>
              <TableHead>Agente</TableHead>
              <TableHead>Naviera</TableHead>
              <TableHead>Contenedor</TableHead>
              <TableHead className="text-right">Flete</TableHead>
              <TableHead className="text-right">Recargos</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && tarifas.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Sin tarifas para los filtros aplicados.</TableCell></TableRow>
            )}
            {tarifas.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm">
                  {t.puerto_origen_nombre} → {t.puerto_destino_nombre}
                </TableCell>
                <TableCell className="font-medium">{t.agente_nombre}</TableCell>
                <TableCell>{t.naviera_nombre}</TableCell>
                <TableCell>{t.tipo_contenedor_nombre}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(Number(t.flete_base))}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(t.recargos_total)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{usd(t.total_comparable)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t.vigente_desde} → {t.vigente_hasta}
                </TableCell>
                <TableCell>
                  <TarifaEstadoBadge estado={t.estado} vigenteHasta={t.vigente_hasta} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => editar(t.id)} aria-label="Editar tarifa">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => duplicar(t.id)} aria-label="Duplicar tarifa">
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setAEliminar(t.id)}
                      aria-label="Eliminar tarifa"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <TarifaForm open={open} onOpenChange={setOpen} initial={initial} tarifaId={editId} />

      <ConfirmDeleteAlert
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        title="¿Eliminar esta tarifa?"
        description="La tarifa se eliminará permanentemente."
        pending={eliminar.isPending}
        onConfirm={() => {
          if (aEliminar) {
            eliminar.mutate(aEliminar, { onSuccess: () => setAEliminar(null) });
          }
        }}
      />
    </div>
  );
}
