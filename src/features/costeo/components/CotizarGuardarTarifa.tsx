/**
 * "Cotizar y guardar tarifa" (clientes especiales): guarda la tarifa nueva y
 * abre la cotización con esa tarifa y el cliente especial ya elegidos.
 * Sólo coordinador logístico / gerente de operaciones (y administradores).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { fetchClientesEspeciales } from "@/features/cliente/services/listado";
import type { CosteoTarifa } from "@/features/costeo/types";

const ROLES = new Set(["coordinador_logistico", "gerente_operaciones", "admin_org", "admin", "super_admin"]);

export const puedeCotizarYGuardar = (rol: string | null | undefined) => !!rol && ROLES.has(rol);

export const rutaCotizacionTarifa = (tarifaId: string, clienteId: string) =>
  `/cotizaciones/nueva?tarifa=${encodeURIComponent(tarifaId)}&cliente=${encodeURIComponent(clienteId)}`;

interface Props {
  disabled: boolean;
  /** Guarda la tarifa y llama `onGuardada` con la fila creada. */
  guardar: (onGuardada: (t: CosteoTarifa) => void) => void;
}

export function CotizarGuardarTarifa({ disabled, guardar }: Props) {
  const { effectiveRole } = useAuth();
  const { organizationId } = useOrgActiva();
  const navigate = useNavigate();
  const [clienteId, setClienteId] = useState("");
  const permitido = puedeCotizarYGuardar(effectiveRole);
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes", "especiales", organizationId],
    queryFn: () => fetchClientesEspeciales(organizationId ?? ""),
    enabled: permitido && !!organizationId,
  });
  if (!permitido || clientes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
      <span className="text-body-sm text-muted-foreground">Cliente especial:</span>
      <Select value={clienteId} onValueChange={setClienteId}>
        <SelectTrigger className="w-56" aria-label="Cliente especial">
          <SelectValue placeholder="Elige el cliente" />
        </SelectTrigger>
        <SelectContent>
          {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" variant="secondary" disabled={disabled || !clienteId}
        title={clienteId ? undefined : "Elige un cliente especial"}
        onClick={() => guardar((t) => navigate(rutaCotizacionTarifa(t.id, clienteId)))}>
        Cotizar y guardar tarifa
      </Button>
    </div>
  );
}
