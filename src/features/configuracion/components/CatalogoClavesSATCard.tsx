/**
 * CatalogoClavesSATCard — Catálogo maestro de productos y servicios por org.
 *
 * Este catálogo es la fuente única de verdad para:
 *   - Determinar la clave SAT y el tipo de IVA de cada renglón al crear una
 *     factura (helper `resolver_clave_sat` en el RPC de conversión).
 *   - Restringir qué productos/servicios pueden capturarse en cotizaciones
 *     (modo estricto: sólo productos del catálogo).
 *
 * Campos por producto:
 *   - Nombre (col `patron` en BD, por compatibilidad con el resolver por ILIKE).
 *   - Clave SAT (código de producto/servicio, ej. 78101800).
 *   - Tipo de IVA: 16%, 0% o Exento.
 *   - Clave de unidad SAT (E48 servicio, H87 pieza, KGM kilogramo, etc.).
 *   - Prioridad + activo + notas.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notifyError } from "@/components/shared/utils/appFeedback";

type TipoIva = "gravado_16" | "tasa_0" | "exento";

interface Row {
  id: string;
  organization_id: string;
  patron: string;
  clave_sat: string;
  prioridad: number;
  activo: boolean;
  notas: string | null;
  tipo_iva: TipoIva;
  clave_unidad_sat: string;
  nombre_unidad: string | null;
}

interface Draft {
  patron: string;
  clave_sat: string;
  prioridad: number;
  activo: boolean;
  notas: string;
  tipo_iva: TipoIva;
  clave_unidad_sat: string;
}

const EMPTY: Draft = {
  patron: "", clave_sat: "", prioridad: 100, activo: true, notas: "",
  tipo_iva: "gravado_16", clave_unidad_sat: "E48",
};

const UNIDADES_SAT: Array<{ value: string; label: string }> = [
  { value: "E48", label: "E48 — Unidad de Servicio" },
  { value: "H87", label: "H87 — Pieza" },
  { value: "XPP", label: "XPP — Paquete" },
  { value: "KGM", label: "KGM — Kilogramo" },
  { value: "TNE", label: "TNE — Tonelada" },
  { value: "MTR", label: "MTR — Metro" },
  { value: "MTQ", label: "MTQ — Metro cúbico" },
  { value: "LTR", label: "LTR — Litro" },
  { value: "ACT", label: "ACT — Actividad" },
];

const TIPO_IVA_LABEL: Record<TipoIva, string> = {
  gravado_16: "IVA 16%",
  tasa_0: "IVA 0%",
  exento: "Exento",
};

const TIPO_IVA_VARIANT: Record<TipoIva, "default" | "secondary" | "outline"> = {
  gravado_16: "default",
  tasa_0: "secondary",
  exento: "outline",
};

function tasaFromTipo(tipo: TipoIva): number | null {
  if (tipo === "gravado_16") return 0.16;
  if (tipo === "tasa_0") return 0;
  return null;
}

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
        .select("id, organization_id, patron, clave_sat, prioridad, activo, notas, tipo_iva, clave_unidad_sat, nombre_unidad")
        .order("prioridad", { ascending: true })
        .order("patron", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["catalogo_claves_sat", organizationId] });
    qc.invalidateQueries({ queryKey: ["productos_catalogo", organizationId] });
  };

  const onError = (err: unknown) =>
    notifyError(toast, { title: "No se pudo guardar el producto", error: err, method: "CATALOGO_PRODUCTOS" });

  const buildPayload = (d: Draft) => ({
    patron: d.patron.trim(),
    clave_sat: d.clave_sat.trim(),
    prioridad: d.prioridad,
    activo: d.activo,
    notas: d.notas.trim() || null,
    tipo_iva: d.tipo_iva,
    tasa_iva_default: tasaFromTipo(d.tipo_iva),
    clave_unidad_sat: d.clave_unidad_sat,
  });

  const addMut = useMutation({
    mutationFn: async (d: Draft) => {
      if (!organizationId) throw new Error("Sin organización");
      const { error } = await supabase.from("catalogo_claves_sat").insert({
        organization_id: organizationId,
        ...buildPayload(d),
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setShowNew(false); setDraft(EMPTY); toast.success("Producto agregado"); },
    onError,
  });

  const updateMut = useMutation({
    mutationFn: async (vars: { id: string; d: Draft }) => {
      const { error } = await supabase
        .from("catalogo_claves_sat")
        .update(buildPayload(vars.d))
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditingId(null); toast.success("Producto actualizado"); },
    onError,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalogo_claves_sat").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Producto eliminado"); },
    onError,
  });

  const busy = addMut.isPending || updateMut.isPending || deleteMut.isPending;

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setDraft({
      patron: r.patron, clave_sat: r.clave_sat, prioridad: r.prioridad,
      activo: r.activo, notas: r.notas ?? "",
      tipo_iva: r.tipo_iva, clave_unidad_sat: r.clave_unidad_sat,
    });
  };

  const validDraft = useMemo(
    () => draft.patron.trim().length > 0 && draft.clave_sat.trim().length >= 6 && draft.clave_unidad_sat.trim().length > 0,
    [draft],
  );

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
        <Button size="sm" variant="outline" onClick={() => { setShowNew(true); setDraft(EMPTY); }} disabled={showNew || busy}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo producto
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Nombre</TableHead>
                <TableHead className="w-[12%]">Clave SAT</TableHead>
                <TableHead className="w-[12%]">Tipo IVA</TableHead>
                <TableHead className="w-[12%]">Unidad SAT</TableHead>
                <TableHead className="w-[8%]">Prioridad</TableHead>
                <TableHead className="w-[8%]">Activo</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-[10%] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-muted-foreground text-center py-4">Cargando…</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && !showNew && (
                <TableRow><TableCell colSpan={8} className="text-muted-foreground text-center py-4">
                  Aún no hay productos. Da de alta al menos uno para poder capturar cotizaciones.
                </TableCell></TableRow>
              )}
              {rows.map((r) => editingId === r.id ? (
                <EditRow key={r.id} draft={draft} setDraft={setDraft} busy={busy} valid={validDraft}
                         onCancel={() => setEditingId(null)}
                         onSave={() => updateMut.mutate({ id: r.id, d: draft })} />
              ) : (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.patron}</TableCell>
                  <TableCell className="font-mono text-xs">{r.clave_sat}</TableCell>
                  <TableCell><Badge variant={TIPO_IVA_VARIANT[r.tipo_iva]}>{TIPO_IVA_LABEL[r.tipo_iva]}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.clave_unidad_sat}</TableCell>
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
      <TableCell><Input value={draft.patron} onChange={(e) => p({ patron: e.target.value })} placeholder="Flete Marítimo" /></TableCell>
      <TableCell><Input value={draft.clave_sat} onChange={(e) => p({ clave_sat: e.target.value })} placeholder="78101800" /></TableCell>
      <TableCell>
        <Select value={draft.tipo_iva} onValueChange={(v) => p({ tipo_iva: v as TipoIva })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gravado_16">IVA 16%</SelectItem>
            <SelectItem value="tasa_0">IVA 0%</SelectItem>
            <SelectItem value="exento">Exento</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={draft.clave_unidad_sat} onValueChange={(v) => p({ clave_unidad_sat: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {UNIDADES_SAT.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
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
