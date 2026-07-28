/**
 * Grilla de campos del formulario de oportunidad.
 * Extraído de `NuevaOportunidadDialog.tsx`.
 */
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import VendedorSelect from "@/features/crm/components/VendedorSelect";
import type { Moneda } from "@/features/crm/hooks";
import type { OportunidadFormState } from "@/features/crm/hooks";

interface Etapa {
  id: string;
  nombre: string;
  probabilidad_default: number;
  tipo?: string;
}

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  form: OportunidadFormState;
  setForm: React.Dispatch<React.SetStateAction<OportunidadFormState>>;
  set: <K extends keyof OportunidadFormState>(k: K, v: OportunidadFormState[K]) => void;
  etapas: Etapa[];
  clientes: ClienteOption[];
  isEdit: boolean;
  autoActividad: boolean;
  setAutoActividad: (v: boolean) => void;
}

export default function OportunidadFormFields({
  form, setForm, set, etapas, clientes, isEdit, autoActividad, setAutoActividad,
}: Props) {
  const etapaSel = etapas.find((e) => e.id === form.etapa_id);
  const esGanada = etapaSel?.tipo === "ganada";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 space-y-1">
        <Label>Nombre *</Label>
        <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Cliente</Label>
        <Select
          value={form.cliente_id ?? "ninguno"}
          onValueChange={(v) => {
            if (v === "ninguno") { set("cliente_id", null); set("cliente_nombre", ""); return; }
            const c = clientes.find((x) => x.id === v);
            set("cliente_id", v);
            set("cliente_nombre", c?.nombre ?? "");
          }}
        >
          <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguno">Sin cliente</SelectItem>
            {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Etapa *</Label>
        <Select
          value={form.etapa_id}
          onValueChange={(v) => {
            set("etapa_id", v);
            const et = etapas.find((e) => e.id === v);
            if (et) set("probabilidad", et.probabilidad_default);
          }}
        >
          <SelectTrigger><SelectValue placeholder="Etapa..." /></SelectTrigger>
          <SelectContent>
            {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Monto estimado</Label>
        <Input
          type="number" min={0} step="0.01"
          value={form.monto_estimado}
          onChange={(e) => set("monto_estimado", Number(e.target.value))}
        />
      </div>
      <div className="space-y-1">
        <Label>Moneda</Label>
        <Select value={form.moneda} onValueChange={(v) => set("moneda", v as Moneda)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Probabilidad (%)</Label>
        <Input
          type="number" min={0} max={100}
          value={form.probabilidad}
          onChange={(e) => set("probabilidad", Number(e.target.value))}
        />
      </div>
      <div className="space-y-1">
        <Label>Fecha estimada cierre</Label>
        <DatePickerMx value={form.fecha_estimada_cierre} onChange={(v) => set("fecha_estimada_cierre", v)} className="w-full" />
      </div>
      {/* B-034: al cerrar en etapa "ganada" exigimos fecha y valor reales;
          sin ellos el Resumen (monto_estimado) y el Leaderboard
          (fecha_cierre_real) se contradicen. */}
      {esGanada && (
        <>
          <div className="space-y-1">
            <Label>Fecha de cierre real *</Label>
            <DatePickerMx value={form.fecha_cierre_real} onChange={(v) => set("fecha_cierre_real", v)} className="w-full" />
          </div>
          <div className="space-y-1">
            <Label>Valor real</Label>
            <Input
              type="number" min={0} step="0.01"
              value={form.valor_real}
              onChange={(e) => set("valor_real", Number(e.target.value))}
            />
          </div>
        </>
      )}
      <div className="space-y-1">
        <Label>Modo</Label>
        <Input value={form.modo} onChange={(e) => set("modo", e.target.value)} placeholder="Marítimo / Aéreo..." />
      </div>
      <div className="space-y-1">
        <Label>Origen</Label>
        <Input value={form.origen} onChange={(e) => set("origen", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Destino</Label>
        <Input value={form.destino} onChange={(e) => set("destino", e.target.value)} />
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
        <Textarea rows={3} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
      </div>
      {!isEdit && (
        <div className="sm:col-span-2 flex items-center gap-2 pt-1">
          <Checkbox
            id="auto-act-op"
            checked={autoActividad}
            onCheckedChange={(v) => setAutoActividad(v === true)}
          />
          <Label htmlFor="auto-act-op" className="text-xs cursor-pointer">
            Crear actividad de seguimiento (tarea, mañana 9:00)
          </Label>
        </div>
      )}
    </div>
  );
}
