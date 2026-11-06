/**
 * "Cotizar y guardar tarifa" (clientes especiales): guarda la tarifa nueva y
 * abre la cotización con esa tarifa y el cliente especial ya elegidos.
 * Sólo coordinador logístico / gerente de operaciones (y administradores).
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useClientesEspeciales } from "@/features/cliente/hooks/useClientesEspeciales";
import { Hint } from "@/components/shared/Hint";
import { puedeCotizarYGuardar, rutaCotizacionTarifa } from "../domain/cotizarGuardarTarifa";
import type { CosteoTarifa } from "@/features/costeo/types";

interface Props {
  disabled: boolean;
  /** Guarda la tarifa y llama `onGuardada` con la fila creada. */
  guardar: (onGuardada: (t: CosteoTarifa) => void) => void;
}

export function CotizarGuardarTarifa(props: Props) {
  const { effectiveRole } = useAuth();
  return puedeCotizarYGuardar(effectiveRole) ? <CotizarGuardarTarifaPanel {...props} /> : null;
}

function CotizarGuardarTarifaPanel({ disabled, guardar }: Props) {
  const navigate = useNavigate();
  const [clienteId, setClienteId] = useState("");
  const { data: clientes = [] } = useClientesEspeciales();
  if (clientes.length === 0) return null;

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
      <Hint label={clienteId ? undefined : "Elige un cliente especial"}>
        <Button type="button" variant="secondary" disabled={disabled || !clienteId}
          onClick={() => guardar((t) => navigate(rutaCotizacionTarifa(t.id, clienteId)))}>
          Cotizar y guardar tarifa
        </Button>
      </Hint>
    </div>
  );
}
