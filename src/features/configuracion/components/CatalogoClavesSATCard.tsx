/**
 * CatalogoClavesSATCard — Catálogo maestro de productos y servicios por org.
 *
 * Fuente única de verdad para:
 *   - Determinar la clave SAT y el tipo de IVA de cada renglón al facturar.
 *   - Restringir qué productos/servicios pueden capturarse en cotizaciones
 *     (modo estricto: sólo productos del catálogo).
 */
import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useCatalogoClavesSATController } from "@/features/configuracion/hooks/useCatalogoClavesSATController";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditRow } from "./CatalogoClavesSATCard.parts";
import {
import { Skeleton } from "@/components/ui/skeleton";
  EMPTY_DRAFT, TIPO_IVA_LABEL, TIPO_IVA_VARIANT,
  type Draft, type Row,
} from "./CatalogoClavesSATCard.constants";

export function CatalogoClavesSATCard() {
  const { rows, isLoading, addMut, updateMut, deleteMut } = useCatalogoClavesSATController();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showNew, setShowNew] = useState(false);

  const busy = addMut.isPending || updateMut.isPending || deleteMut.isPending;

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setDraft({
      patron: r.patron, clave_sat: r.clave_sat,
      activo: r.activo,
      tipo_iva: r.tipo_iva, clave_unidad_sat: r.clave_unidad_sat,
    });
  };

  const validDraft = useMemo(
    () => draft.patron.trim().length > 0 && draft.clave_sat.trim().length >= 6 && draft.clave_unidad_sat.trim().length > 0,
    [draft],
  );

  const handleAdd = () => {
    addMut.mutate(draft, { onSuccess: () => { setShowNew(false); setDraft(EMPTY_DRAFT); } });
  };

  const handleUpdate = () => {
    updateMut.mutate({ id: editingId as string, d: draft }, { onSuccess: () => setEditingId(null) });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Catálogo de productos y servicios</CardTitle>
          <CardDescription>
            Da de alta cada producto/servicio que tu empresa vende. Cada uno lleva su clave SAT,
            tipo de IVA y unidad. Las cotizaciones sólo permiten elegir productos de este catálogo,
            y al facturar se usa esta información automáticamente.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setShowNew(true); setDraft(EMPTY_DRAFT); }} disabled={showNew || busy}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo producto
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Nombre</TableHead>
                <TableHead className="w-[14%]">Clave SAT</TableHead>
                <TableHead className="w-[14%]">Tipo IVA</TableHead>
                <TableHead className="w-[14%]">Unidad SAT</TableHead>
                <TableHead className="w-[10%]">Activo</TableHead>
                <TableHead className="w-[12%] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow role="status" aria-busy="true">
                  <TableCell colSpan={6} className="py-4">
                    <span className="sr-only">Cargando…</span>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && !showNew && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center py-4">
                  Aún no hay productos. Da de alta al menos uno para poder capturar cotizaciones.
                </TableCell></TableRow>
              )}
              {rows.map((r) => editingId === r.id ? (
                <EditRow key={r.id} draft={draft} setDraft={setDraft} busy={busy} valid={validDraft}
                         onCancel={() => setEditingId(null)}
                         onSave={handleUpdate} />
              ) : (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.patron}</TableCell>
                  <TableCell className="font-mono text-xs">{r.clave_sat}</TableCell>
                  <TableCell><Badge variant={TIPO_IVA_VARIANT[r.tipo_iva]}>{TIPO_IVA_LABEL[r.tipo_iva]}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.clave_unidad_sat}</TableCell>
                  <TableCell>{r.activo ? "Sí" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)} disabled={busy}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(r.id)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {showNew && (
                <EditRow draft={draft} setDraft={setDraft} busy={busy} valid={validDraft}
                         onCancel={() => { setShowNew(false); setDraft(EMPTY_DRAFT); }}
                         onSave={handleAdd} />
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
