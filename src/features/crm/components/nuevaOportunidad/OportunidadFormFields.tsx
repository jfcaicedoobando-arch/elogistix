/**
 * Grilla de campos del formulario de oportunidad.
 * Extraído de `NuevaOportunidadDialog.tsx`.
 */
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
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
import SelectorOrigenOportunidad from "./SelectorOrigenOportunidad";
import OportunidadMetasFields from "./OportunidadMetasFields";
import OportunidadRutaFields from "./OportunidadRutaFields";
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
      {/* Fase 2 rediseño CRM: el origen (prospecto o cliente) es obligatorio. */}
      <SelectorOrigenOportunidad
        origenTipo={form.origen_tipo}
        onOrigenTipoChange={(t) =>
          setForm((f) => ({
            ...f,
            origen_tipo: t,
            lead_id: t === "prospecto" ? f.lead_id : null,
            lead_nombre: t === "prospecto" ? f.lead_nombre : "",
            cliente_id: t === "cliente" ? f.cliente_id : null,
            cliente_nombre: t === "cliente" ? f.cliente_nombre : "",
          }))
        }
        leadId={form.lead_id}
        leadNombre={form.lead_nombre}
        onProspecto={(p) =>
          setForm((f) => ({
            ...f,
            lead_id: p.id,
            lead_nombre: p.empresa,
            nombre: f.nombre.trim() ? f.nombre : `Oportunidad ${p.empresa}`,
            vendedor_id: p.vendedorId ?? f.vendedor_id,
            vendedor_email: p.vendedorEmail ?? f.vendedor_email,
          }))
        }
        clienteId={form.cliente_id}
        clienteNombre={form.cliente_nombre}
        onCliente={(c) =>
          setForm((f) => ({
            ...f,
            cliente_id: c.id,
            cliente_nombre: c.nombre,
            nombre: f.nombre.trim() ? f.nombre : `Oportunidad ${c.nombre}`,
          }))
        }
        clientes={clientes}
        readOnly={isEdit}
      />
      <div className="sm:col-span-2 space-y-1">
        <Label htmlFor="op-nombre">Nombre *</Label>
        <Input id="op-nombre" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="op-etapa">Etapa *</Label>
        {/*
          v13.823.52 — la etapa SIEMPRE es de sólo lectura: al crear se usa la
          primera etapa abierta (nunca Ganada/Perdida) y moverla después debe
          pasar por la acción canónica del pipeline (Kanban/detalle), que exige
          motivo de pérdida y fuerza la probabilidad terminal.
        */}
        <Input
          id="op-etapa"
          value={etapas.find((e) => e.id === form.etapa_id)?.nombre ?? "—"}
          readOnly
          disabled
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="op-monto-estimado">Monto estimado</Label>
        <MoneyInput
          id="op-monto-estimado"
          value={form.monto_estimado}
          currency={form.moneda}
          onChange={(n: number) => set("monto_estimado", n)}
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
        <Label htmlFor="op-probabilidad">Probabilidad (%)</Label>
        <Input
          id="op-probabilidad"
          type="number" min={0} max={100}
          value={form.probabilidad}
          // EC-09: min/max HTML no clampean escritura manual; sin el clamp el
          // guardado explotaba contra el CHECK (probabilidad BETWEEN 0 AND 100).
          onChange={(e) => set("probabilidad", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        />
        {(form.probabilidad < 0 || form.probabilidad > 100) && (
          <p className="text-body-sm text-destructive mt-1">La probabilidad debe estar entre 0 y 100.</p>
        )}
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
            <Label htmlFor="op-valor-real">Valor real</Label>
            <MoneyInput
              id="op-valor-real"
              value={form.valor_real}
              currency={form.moneda}
              onChange={(n: number) => set("valor_real", n)}
            />
          </div>
        </>
      )}
      <OportunidadRutaFields form={form} set={set} />
      <OportunidadMetasFields form={form} set={set} />
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
          <Label size="sm" htmlFor="auto-act-op" className="cursor-pointer">
            Crear actividad de seguimiento (tarea, mañana 9:00)
          </Label>
        </div>
      )}
    </div>
  );
}
