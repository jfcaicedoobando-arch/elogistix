/**
 * /crm/leads/:id — Ficha de lead con edición en línea, eliminación y conversión.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Repeat, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { usePermissions } from "@/hooks/shared";
import ConvertirLeadDialog from "@/components/crm/ConvertirLeadDialog";
import { LeadLineageCard } from "@/components/crm/LineageCard";
import {
  LEAD_ESTADOS,
  LEAD_FUENTES,
  useActualizarLead,
  useEliminarLead,
  useLead,
  type CrmLeadEstado,
  type CrmLeadFuente,
} from "@/hooks/crm/useLeads";

export default function LeadDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const { data: lead, isLoading } = useLead(id);
  const actualizar = useActualizarLead();
  const eliminar = useEliminarLead();

  const [form, setForm] = useState(() => ({
    empresa: "",
    contacto: "",
    email: "",
    telefono: "",
    ciudad: "",
    pais: "",
    fuente: "Otro" as CrmLeadFuente,
    estado: "Nuevo" as CrmLeadEstado,
    score: 3,
    interes_modo: "",
    notas: "",
  }));
  const [convertirOpen, setConvertirOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm({
        empresa: lead.empresa ?? "",
        contacto: lead.contacto ?? "",
        email: lead.email ?? "",
        telefono: lead.telefono ?? "",
        ciudad: lead.ciudad ?? "",
        pais: lead.pais ?? "",
        fuente: lead.fuente,
        estado: lead.estado,
        score: lead.score ?? 3,
        interes_modo: lead.interes_modo ?? "",
        notas: lead.notas ?? "",
      });
    }
  }, [lead]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const dirty = useMemo(() => {
    if (!lead) return false;
    return (
      lead.empresa !== form.empresa ||
      (lead.contacto ?? "") !== form.contacto ||
      (lead.email ?? "") !== form.email ||
      (lead.telefono ?? "") !== form.telefono ||
      (lead.ciudad ?? "") !== form.ciudad ||
      (lead.pais ?? "") !== form.pais ||
      lead.fuente !== form.fuente ||
      lead.estado !== form.estado ||
      (lead.score ?? 3) !== form.score ||
      (lead.interes_modo ?? "") !== form.interes_modo ||
      (lead.notas ?? "") !== form.notas
    );
  }, [lead, form]);

  const handleSave = async () => {
    if (!id) return;
    try {
      await actualizar.mutateAsync({ id, patch: form });
      notifySuccess(toast, { title: "Cambios guardados" });
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await eliminar.mutateAsync(id);
      notifySuccess(toast, { title: "Lead eliminado" });
      navigate("/crm/leads");
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo eliminar",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/leads")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <p className="text-muted-foreground">Lead no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/leads")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Leads
        </Button>
      </div>

      <PageHeader
        title={lead.empresa}
        description={`Lead · ${lead.fuente} · creado ${new Date(lead.created_at).toLocaleDateString("es-MX")}`}
        actions={
          <div className="flex gap-2">
            {lead.estado === "Convertido" ? (
              <Badge variant="outline">Convertido</Badge>
            ) : null}
            {canEdit && (
              <Button variant="outline" onClick={() => setConvertirOpen(true)}>
                <Repeat className="h-4 w-4 mr-1" />
                {lead.estado === "Convertido" ? "Ver conversión" : "Convertir"}
              </Button>
            )}
            {canEdit && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del lead</CardTitle>
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
              <Button onClick={handleSave} disabled={!dirty || actualizar.isPending}>
                {actualizar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <LeadLineageCard leadId={lead.id} />

      <ConvertirLeadDialog open={convertirOpen} onOpenChange={setConvertirOpen} lead={lead} />

      <DoubleConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName={lead.empresa}
        onConfirm={handleDelete}
        isPending={eliminar.isPending}
      />
    </div>
  );
}
