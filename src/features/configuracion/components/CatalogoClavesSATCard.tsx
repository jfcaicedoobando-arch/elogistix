/**
 * CatalogoClavesSATCard — CRUD del catálogo por-organización que mapea
 * patrones de descripción a claves SAT. Al convertir una proforma en
 * factura, el RPC `convertir_proformas_a_factura` consulta esta tabla
 * (helper `resolver_clave_sat`) para elegir la clave por renglón.
 *
 * Reglas:
 *   - `patron` se compara con `ILIKE '%patron%'` contra la descripción.
 *   - `prioridad` menor gana. Empate: patrón más largo (más específico).
 *   - Sólo admin / admin_org / contador / super_admin pueden editar (RLS).
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notifyError } from "@/components/shared/utils/appFeedback";

interface Row {
  id: string;
  organization_id: string;
  patron: string;
  clave_sat: string;
  prioridad: number;
  activo: boolean;
  notas: string | null;
}

interface Draft {
  patron: string;
  clave_sat: string;
  prioridad: number;
  activo: boolean;
  notas: string;
}

const EMPTY: Draft = { patron: "", clave_sat: "", prioridad: 100, activo: true, notas: "" };

export function CatalogoClavesSATCard() {
  const { organizationId } = useAuth();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [showNew, setShowNew] = useState(false);

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["catalogo_claves_sat", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_claves_sat")
        .select("id, organization_id, patron, clave_sat, prioridad, activo, notas")
        .order("prioridad", { ascending: true })
        .order("patron", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["catalogo_claves_sat", organizationId] });

  const onError = (err: unknown) =>
    notifyError(toast, { title: "No se pudo guardar la regla", error: err, method: "CATALOGO_SAT" });

  const addMut = useMutation({
    mutationFn: async (d: Draft) => {
      if (!organizationId) throw new Error("Sin organización");
      const { error } = await supabase.from("catalogo_claves_sat").insert({
        organization_id: organizationId,
        patron: d.patron.trim(),
        clave_sat: d.clave_sat.trim(),
        prioridad: d.prioridad,
        activo: d.activo,
        notas: d.notas.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setShowNew(false); setDraft(EMPTY); toast.success("Regla agregada"); },
    onError,
  });

  const updateMut = useMutation({
    mutationFn: async (vars: { id: string; d: Draft }) => {
      const { error } = await supabase
        .from("catalogo_claves_sat")
        .update({
          patron: vars.d.patron.trim(),
          clave_sat: vars.d.clave_sat.trim(),
          prioridad: vars.d.prioridad,
          activo: vars.d.activo,
          notas: vars.d.notas.trim() || null,
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditingId(null); toast.success("Regla actualizada"); },
    onError,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalogo_claves_sat").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Regla eliminada"); },
    onError,
  });

  const busy = addMut.isPending || updateMut.isPending || deleteMut.isPending;

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setDraft({
      patron: r.patron, clave_sat: r.clave_sat, prioridad: r.prioridad,
      activo: r.activo, notas: r.notas ?? "",
    });
  };

  const validDraft = useMemo(() => draft.patron.trim().length > 0 && draft.clave_sat.trim().length >= 6, [draft]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Catálogo de claves SAT por concepto</CardTitle>
          <CardDescription>
            Define qué clave SAT usar según la descripción de cada renglón. Al generar una
            factura desde una proforma, el sistema busca aquí antes de caer al default (78101800).
            Ejemplo: patrón <b>Flete</b> → clave <b>78101800</b>; patrón <b>Almacenaje</b> → <b>80131502</b>.
            El patrón de menor <b>prioridad</b> gana; si hay empate, gana el patrón más largo.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setShowNew(true); setDraft(EMPTY); }} disabled={showNew || busy}>
          <Plus className="h-4 w-4 mr-1" /> Nueva regla
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Patrón (contiene)</TableHead>
                <TableHead className="w-[18%]">Clave SAT</TableHead>
                <TableHead className="w-[10%]">Prioridad</TableHead>
                <TableHead className="w-[10%]">Activo</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-[10%] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center py-4">Cargando…</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && !showNew && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center py-4">
                  Aún no hay reglas. Todas las facturas usarán la clave por defecto <b>78101800</b>.
                </TableCell></TableRow>
              )}
              {rows.map((r) => editingId === r.id ? (
                <EditRow key={r.id} draft={draft} setDraft={setDraft} busy={busy} valid={validDraft}
                         onCancel={() => setEditingId(null)}
                         onSave={() => updateMut.mutate({ id: r.id, d: draft })} />
              ) : (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.patron}</TableCell>
                  <TableCell className="font-mono">{r.clave_sat}</TableCell>
                  <TableCell>{r.prioridad}</TableCell>
                  <TableCell>{r.activo ? "Sí" : "No"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.notas ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)} disabled={busy}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(r.id)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {showNew && (
                <EditRow draft={draft} setDraft={setDraft} busy={busy} valid={validDraft}
                         onCancel={() => { setShowNew(false); setDraft(EMPTY); }}
                         onSave={() => addMut.mutate(draft)} />
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface EditProps {
  draft: Draft; setDraft: (d: Draft) => void; onCancel: () => void; onSave: () => void; busy: boolean; valid: boolean;
}
function EditRow({ draft, setDraft, onCancel, onSave, busy, valid }: EditProps) {
  const p = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  return (
    <TableRow className="bg-muted/30">
      <TableCell><Input value={draft.patron} onChange={(e) => p({ patron: e.target.value })} placeholder="Flete" /></TableCell>
      <TableCell><Input value={draft.clave_sat} onChange={(e) => p({ clave_sat: e.target.value })} placeholder="78101800" /></TableCell>
      <TableCell><Input type="number" min={1} value={draft.prioridad} onChange={(e) => p({ prioridad: Number(e.target.value) || 100 })} /></TableCell>
      <TableCell><Switch checked={draft.activo} onCheckedChange={(v) => p({ activo: v })} /></TableCell>
      <TableCell><Input value={draft.notas} onChange={(e) => p({ notas: e.target.value })} placeholder="opcional" /></TableCell>
      <TableCell className="text-right">
        <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy}><X className="h-4 w-4" /></Button>
        <Button size="icon" onClick={onSave} disabled={busy || !valid}><Check className="h-4 w-4" /></Button>
      </TableCell>
    </TableRow>
  );
}

export default CatalogoClavesSATCard;
