import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import VendedorSelect from "@/features/crm/components/VendedorSelect";
import {
  LEAD_ESTADOS, LEAD_FUENTES, type CrmLeadEstado, type CrmLeadFuente,
} from "@/features/crm/hooks";

export interface LeadFormState {
  empresa: string;
  contacto: string;
  email: string;
  telefono: string;
  ciudad: string;
  pais: string;
  fuente: CrmLeadFuente;
  estado: CrmLeadEstado;
  interes_modo: string;
  notas: string;
  vendedor_id: string | null;
  vendedor_email: string;
}

interface Props {
  form: LeadFormState;
  setForm: React.Dispatch<React.SetStateAction<LeadFormState>>;
  autoActividad: boolean;
  setAutoActividad: (v: boolean) => void;
}

export function NuevoLeadForm({ form, setForm, autoActividad, setAutoActividad }: Props) {
  const set = <K extends keyof LeadFormState>(k: K, v: LeadFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
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
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LEAD_FUENTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Estado</Label>
        <Select value={form.estado} onValueChange={(v) => set("estado", v as CrmLeadEstado)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LEAD_ESTADOS.filter((s) => s !== "Convertido").map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <VendedorSelect
          value={form.vendedor_id}
          email={form.vendedor_email}
          onChange={(id, email) => setForm((f) => ({ ...f, vendedor_id: id, vendedor_email: email }))}
        />
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label>Notas</Label>
        <Textarea
          rows={3}
          value={form.notas}
          onChange={(e) => set("notas", e.target.value)}
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-2 pt-1">
        <Checkbox
          id="auto-act-lead"
          checked={autoActividad}
          onCheckedChange={(v) => setAutoActividad(v === true)}
        />
        <Label htmlFor="auto-act-lead" className="text-xs cursor-pointer">
          Crear actividad de seguimiento (llamada, mañana 9:00)
        </Label>
      </div>
    </div>
  );
}
