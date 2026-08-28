/**
 * Opciones del selector de origen (extraído de `SelectorOrigenOportunidad`
 * para mantener la complejidad por función dentro del límite del proyecto).
 */
import { Check, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ProspectoOption {
  id: string;
  empresa: string;
  estado: string;
  vendedor_id: string | null;
  vendedor_email: string | null;
}

export interface ClienteOption {
  id: string;
  nombre: string;
}

export function OpcionesProspecto({
  prospectos, leadId, onProspecto,
}: {
  prospectos: ProspectoOption[];
  leadId: string | null;
  onProspecto: (p: { id: string; empresa: string; vendedorId: string | null; vendedorEmail: string | null }) => void;
}) {
  return (
    <>
      {prospectos.map((p) => (
        <CommandItem
          key={p.id}
          value={p.id}
          onSelect={() => onProspecto({
            id: p.id,
            empresa: p.empresa,
            vendedorId: p.vendedor_id,
            vendedorEmail: p.vendedor_email,
          })}
        >
          <Check className={cn("mr-2 h-4 w-4", leadId === p.id ? "opacity-100" : "opacity-0")} />
          <span className="truncate">{p.empresa}</span>
          <Badge variant="outline" className="ml-auto">{p.estado}</Badge>
        </CommandItem>
      ))}
    </>
  );
}

export function OpcionesCliente({
  clientes, clienteId, onCliente,
}: {
  clientes: ClienteOption[];
  clienteId: string | null;
  onCliente: (c: ClienteOption) => void;
}) {
  return (
    <>
      {clientes.map((c) => (
        <CommandItem key={c.id} value={c.nombre} onSelect={() => onCliente(c)}>
          <Check className={cn("mr-2 h-4 w-4", clienteId === c.id ? "opacity-100" : "opacity-0")} />
          <span className="truncate">{c.nombre}</span>
        </CommandItem>
      ))}
    </>
  );
}

export function AyudaOrigen({ esProspecto }: { esProspecto: boolean }) {
  const destino = esProspecto ? "/crm/prospectos" : "/clientes";
  return (
    <p className="text-label text-muted-foreground">
      {esProspecto
        ? "Sólo aparecen prospectos calificados. "
        : "Clientes ya dados de alta con RFC y régimen fiscal. "}
      <Link to={destino} className="inline-flex items-center gap-1 underline">
        {esProspecto ? "Ver prospectos" : "Ver clientes"} <ExternalLink className="h-3 w-3" />
      </Link>
    </p>
  );
}
