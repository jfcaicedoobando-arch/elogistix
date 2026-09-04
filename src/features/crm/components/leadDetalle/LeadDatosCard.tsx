/**
 * Card con el formulario de edición de datos básicos del lead.
 * Extraído de `pages/crm/LeadDetalle.tsx`.
 */
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
import { Badge } from "@/components/ui/badge";
import {
  LEAD_ESTADOS_MANUALES,
  LEAD_ESTADO_DERIVADO_AYUDA,
  LEAD_FUENTES,
  esEstadoDerivado,
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
  /** Mensaje inline cuando el correo capturado no es válido. */
  errorEmail?: string | null;
}

export default function LeadDatosCard({ form, set, canEdit, dirty, isSaving, onSave, errorEmail = null }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del lead</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="lead-datos-empresa">Empresa</Label>
            <Input id="lead-datos-empresa" value={form.empresa} onChange={(e) => set("empresa", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-datos-contacto">Contacto</Label>
            <Input id="lead-datos-contacto" value={form.contacto} onChange={(e) => set("contacto", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-datos-email">Correo</Label>
            <Input
              id="lead-datos-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={!canEdit}
              aria-invalid={errorEmail ? true : undefined}
              aria-describedby={errorEmail ? "lead-datos-email-error" : undefined}
            />
            {errorEmail ? (
              <p id="lead-datos-email-error" role="alert" className="text-body-sm text-destructive">
                {errorEmail}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-datos-telefono">Teléfono</Label>
            <Input id="lead-datos-telefono" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-datos-ciudad">Ciudad</Label>
            <Input id="lead-datos-ciudad" value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-datos-pais">País</Label>
            <Input id="lead-datos-pais" value={form.pais} onChange={(e) => set("pais", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-datos-interes-modo">Interés (modo)</Label>
            <Input id="lead-datos-interes-modo" value={form.interes_modo} onChange={(e) => set("interes_modo", e.target.value)} disabled={!canEdit} />
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
            {esEstadoDerivado(form.estado) ? (
              // v13.823.62: estado administrado por el ERP → sólo lectura.
              <div className="flex h-10 items-center gap-2">
                <Badge variant="outline">{form.estado}</Badge>
                <span className="text-body-sm text-muted-foreground">
                  {LEAD_ESTADO_DERIVADO_AYUDA}
                </span>
              </div>
            ) : (
              <Select value={form.estado} onValueChange={(v) => set("estado", v as CrmLeadEstado)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_ESTADOS_MANUALES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-datos-score">Score (1-5)</Label>
            <Input
              id="lead-datos-score"
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
            <Button onClick={onSave} disabled={!dirty} loading={isSaving}>
              Guardar cambios
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
