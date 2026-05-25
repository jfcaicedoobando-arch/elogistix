/**
 * Diálogo para crear un nuevo Lead (CRM Fase 2).
 * Formulario simple — los campos avanzados se editan en LeadDetalle.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import VendedorSelect from "@/components/crm/VendedorSelect";
import { useAuth } from "@/contexts/AuthContext";
import {
  LEAD_ESTADOS,
  LEAD_FUENTES,
  useCrearLead,
  type CrmLeadEstado,
  type CrmLeadFuente,
} from "@/hooks/crm/useLeads";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

const EMPTY = {
  empresa: "",
  contacto: "",
  email: "",
  telefono: "",
  ciudad: "",
  pais: "México",
  fuente: "Otro" as CrmLeadFuente,
  estado: "Nuevo" as CrmLeadEstado,
  interes_modo: "",
  notas: "",
  vendedor_id: null as string | null,
  vendedor_email: "",
};

export default function NuevoLeadDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({ ...EMPTY, vendedor_id: user?.id ?? null, vendedor_email: user?.email ?? "" }));
  const crear = useCrearLead();
  const { toast } = useToast();

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.empresa.trim()) {
      notifyError(toast, { title: "Empresa es obligatoria" });
      return;
    }
    try {
      const r = await crear.mutateAsync(form);
      notifySuccess(toast, { title: "Lead creado" });
      setForm(EMPTY);
      onOpenChange(false);
      onCreated?.(r.id);
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo crear el lead",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setForm(EMPTY);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Nuevo Lead</DialogTitle>
          <DialogDescription>
            Captura los datos básicos del prospecto. Podrás convertirlo a cliente y oportunidad desde su ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label>Empresa *</Label>
            <Input value={form.empresa} onChange={(e) => set("empresa", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Contacto</Label>
            <Input value={form.contacto} onChange={(e) => set("contacto", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Ciudad</Label>
            <Input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>País</Label>
            <Input value={form.pais} onChange={(e) => set("pais", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Interés (modo)</Label>
            <Input
              placeholder="Marítimo / Aéreo / Terrestre…"
              value={form.interes_modo}
              onChange={(e) => set("interes_modo", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Fuente</Label>
            <Select value={form.fuente} onValueChange={(v) => set("fuente", v as CrmLeadFuente)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_FUENTES.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v as CrmLeadEstado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_ESTADOS.filter((s) => s !== "Convertido").map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Notas</Label>
            <Textarea
              rows={3}
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={crear.isPending}>
            {crear.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Crear lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
