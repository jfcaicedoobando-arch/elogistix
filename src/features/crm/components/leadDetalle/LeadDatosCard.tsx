/**
 * Card con el formulario de edición de datos básicos del lead.
 * Extraído de `pages/crm/LeadDetalle.tsx`.
 */
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_ESTADOS,
  LEAD_FUENTES,
  type CrmLeadEstado,
  type CrmLeadFuente,
} from "@/features/crm/hooks";
import type { LeadEditForm } from "@/features/crm/hooks";

interface Props {
  form: LeadEditForm;
  set: <K extends keyof LeadEditForm>(k: K, v: LeadEditForm[K]) => void;
  canEdit: boolean;
  dirty: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export default function LeadDatosCard({ form, set, canEdit, dirty, isSaving, onSave }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del lead</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label>Empresa</Label>
            <Input value={form.empresa} onChange={(e) => set("empresa", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label>Contacto</Label>
            <Input value={form.contacto} onChange={(e) => set("contacto", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label>Ciudad</Label>
            <Input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label>País</Label>
            <Input value={form.pais} onChange={(e) => set("pais", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label>Interés (modo)</Label>
            <Input value={form.interes_modo} onChange={(e) => set("interes_modo", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label>Fuente</Label>
            <Select value={form.fuente} onValueChange={(v) => set("fuente", v as CrmLeadFuente)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_FUENTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v as CrmLeadEstado)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_ESTADOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Score (1-5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={form.score}
              onChange={(e) => set("score", Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              disabled={!canEdit}
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Notas</Label>
            <Textarea rows={4} value={form.notas} onChange={(e) => set("notas", e.target.value)} disabled={!canEdit} />
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end mt-4">
            <Button onClick={onSave} disabled={!dirty || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
