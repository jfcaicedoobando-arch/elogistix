/**
 * Grilla de campos del formulario de oportunidad.
 * Extraído de `NuevaOportunidadDialog.tsx`.
 */
import { Input } from "@/components/ui/input";
import { MSG_SIN_ETAPA_ABIERTA } from "@/features/crm/domain/oportunidadFormHelpers";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import VendedorSelect from "@/features/crm/components/VendedorSelect";
import SelectorOrigenOportunidad from "./SelectorOrigenOportunidad";
import OportunidadMetasFields from "./OportunidadMetasFields";
import OportunidadMontosFields from "./OportunidadMontosFields";
import OportunidadRutaFields from "./OportunidadRutaFields";
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
        {/* v13.823.53 — sin etapas abiertas no se puede crear ni mostrar etapa. */}
        {!form.etapa_id && (
          <p role="alert" className="text-body-sm text-destructive">{MSG_SIN_ETAPA_ABIERTA}</p>
        )}
      </div>

      <OportunidadMontosFields form={form} set={set} esGanada={esGanada} />
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
