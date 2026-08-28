/**
 * Selector de cliente EXISTENTE para la conversión de leads.
 *
 * El alta de clientes vive sólo en el módulo de Clientes (candado de BD
 * `LC_LEAD_ALTA_CLIENTE_PROHIBIDA`): aquí únicamente se liga uno ya capturado,
 * o se deja la oportunidad sin cliente para ligarlo después.
 */
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useClientesForSelect } from "@/features/cliente/hooks";
import { SIN_CLIENTE } from "@/features/crm/constants/crmConstants";

interface Props {
  value: string;
  onChange: (clienteId: string) => void;
  disabled?: boolean;
  id?: string;
}

export default function SelectorClienteExistente({
  value,
  onChange,
  disabled,
  id = "convertir-cliente-existente",
}: Props) {
  const { data: clientes = [], isLoading } = useClientesForSelect();

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Cliente del directorio (opcional)</Label>
      <Select value={value || SIN_CLIENTE} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={isLoading ? "Cargando clientes…" : "Sin cliente"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN_CLIENTE}>Sin cliente (ligar después)</SelectItem>
          {clientes.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-label text-muted-foreground">
        El alta de clientes se hace en el módulo de Clientes, con RFC, CP y régimen fiscal.{" "}
        <Link to="/clientes" className="inline-flex items-center gap-1 underline">
          Dar de alta cliente <ExternalLink className="h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}
