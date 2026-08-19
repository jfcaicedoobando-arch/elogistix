/**
 * Campos de contacto y ruta del perfil ICP (cargo, origen, destino).
 * Separado de `LeadIcpFields` para respetar Power of 10 (≤200 líneas).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeadIcpForm } from "@/features/crm/domain/leads/icp";

interface Props {
  form: LeadIcpForm;
  set: <K extends keyof LeadIcpForm>(k: K, v: LeadIcpForm[K]) => void;
  canEdit: boolean;
}

export default function LeadIcpContactoFields({ form, set, canEdit }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label htmlFor="lead-icp-cargo-contacto">Cargo del contacto</Label>
        <Input
          id="lead-icp-cargo-contacto"
          placeholder="Compras, Tráfico, Dirección…"
          value={form.cargo_contacto}
          onChange={(e) => set("cargo_contacto", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-origen">Origen</Label>
        <Input
          id="lead-icp-origen"
          placeholder="Shanghái, CN"
          value={form.origen}
          onChange={(e) => set("origen", e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-icp-destino">Destino / entrega</Label>
        <Input
          id="lead-icp-destino"
          placeholder="Toluca, MX"
          value={form.destino}
          onChange={(e) => set("destino", e.target.value)}
          disabled={!canEdit}
        />
      </div>
    </div>
  );
}
