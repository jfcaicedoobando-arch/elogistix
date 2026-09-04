/**
 * Campos de origen (cliente/prospecto) del alta express de oportunidad.
 * Extraído de `QuickCreateOportunidadDialog.tsx`.
 */
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadComboboxCrm } from "@/features/crm/components/comboboxes/EntidadComboboxCrm";
import { LEAD_ESTADOS_ETAPA_PROSPECTO } from "@/features/crm/domain/leads/etapas";
import type { OrigenTipo } from "@/features/crm/hooks/useQuickCreateOportunidad";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  origenTipo: OrigenTipo;
  onOrigenTipoChange: (t: OrigenTipo) => void;
  clienteId: string;
  onClienteIdChange: (id: string) => void;
  clientes: ClienteOption[];
  leadId: string;
  onLead: (id: string, label: string, meta?: { vendedor_id?: string | null; vendedor_email?: string }) => void;
}

export default function QuickCreateOportunidadOrigenFields({
  origenTipo, onOrigenTipoChange, clienteId, onClienteIdChange, clientes, leadId, onLead,
}: Props) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="qc-oportunidad-origen">Origen *</Label>
        <Select
          value={origenTipo}
          onValueChange={(v) => onOrigenTipoChange(v as OrigenTipo)}
        >
          <SelectTrigger id="qc-oportunidad-origen"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cliente">Cliente</SelectItem>
            <SelectItem value="prospecto">Prospecto calificado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {origenTipo === "cliente" ? (
        <div className="space-y-1">
          <Label htmlFor="qc-oportunidad-cliente">Cliente *</Label>
          <Select value={clienteId} onValueChange={onClienteIdChange}>
            <SelectTrigger id="qc-oportunidad-cliente"><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
            <SelectContent>
              {clientes.slice(0, 50).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-1">
          <Label>Prospecto calificado *</Label>
          <LeadComboboxCrm
            value={leadId}
            estadoIn={LEAD_ESTADOS_ETAPA_PROSPECTO}
            placeholder="Selecciona un prospecto…"
            onChange={onLead}
          />
        </div>
      )}
    </>
  );
}
