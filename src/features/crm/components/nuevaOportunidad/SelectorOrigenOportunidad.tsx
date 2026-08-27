/**
 * Selector de ORIGEN de la oportunidad (Fase 2 rediseño CRM).
 *
 * Toda oportunidad nace de:
 *  - un Prospecto calificado (lead que pasó el gate ICP), o
 *  - un Cliente del directorio (ya dado de alta con RFC en el módulo Clientes).
 *
 * No existe la opción "sin origen": el guard de base de datos
 * `_crm_oportunidad_requiere_origen` la rechaza.
 */
import { useState } from "react";
import { Check, ChevronsUpDown, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProspectosForSelect } from "@/features/crm/hooks";
import { cn } from "@/lib/utils";
import type { OportunidadOrigenTipo } from "@/features/crm/domain/oportunidadFormState";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  origenTipo: OportunidadOrigenTipo;
  onOrigenTipoChange: (t: OportunidadOrigenTipo) => void;
  leadId: string | null;
  leadNombre: string;
  onProspecto: (p: { id: string; empresa: string; vendedorId: string | null; vendedorEmail: string | null }) => void;
  clienteId: string | null;
  clienteNombre: string;
  onCliente: (c: ClienteOption) => void;
  clientes: ClienteOption[];
  /** En edición el origen no se cambia: rompería la trazabilidad del embudo. */
  readOnly?: boolean;
}

export default function SelectorOrigenOportunidad({
  origenTipo, onOrigenTipoChange,
  leadId, leadNombre, onProspecto,
  clienteId, clienteNombre, onCliente, clientes,
  readOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const { data: prospectos = [], isLoading } = useProspectosForSelect(busqueda);

  const esProspecto = origenTipo === "prospecto";
  const etiqueta = esProspecto
    ? (leadNombre || "Selecciona un prospecto…")
    : (clienteNombre || "Selecciona un cliente…");
  const sinSeleccion = esProspecto ? !leadId : !clienteId;

  if (readOnly) {
    return (
      <div className="sm:col-span-2 space-y-1">
        <Label>Origen</Label>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{esProspecto ? "Prospecto" : "Cliente"}</Badge>
          <span className="text-body-sm">{etiqueta}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 space-y-2 rounded-md border border-border p-3">
      <Label>Origen de la oportunidad *</Label>
      <Tabs
        value={origenTipo}
        onValueChange={(v) => { onOrigenTipoChange(v as OportunidadOrigenTipo); setBusqueda(""); }}
      >
        <TabsList>
          <TabsTrigger value="prospecto">Prospecto</TabsTrigger>
          <TabsTrigger value="cliente">Cliente actual</TabsTrigger>
        </TabsList>
      </Tabs>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", sinSeleccion && "text-muted-foreground")}
          >
            {etiqueta}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={!esProspecto}>
            <CommandInput
              placeholder={esProspecto ? "Buscar prospecto…" : "Buscar cliente…"}
              value={esProspecto ? busqueda : undefined}
              onValueChange={esProspecto ? setBusqueda : undefined}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading && esProspecto ? "Buscando…" : "Sin resultados"}
              </CommandEmpty>
              <CommandGroup>
                {esProspecto
                  ? prospectos.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.id}
                        onSelect={() => {
                          onProspecto({
                            id: p.id,
                            empresa: p.empresa,
                            vendedorId: p.vendedor_id,
                            vendedorEmail: p.vendedor_email,
                          });
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", leadId === p.id ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{p.empresa}</span>
                        <Badge variant="outline" className="ml-auto">{p.estado}</Badge>
                      </CommandItem>
                    ))
                  : clientes.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.nombre}
                        onSelect={() => { onCliente(c); setOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", clienteId === c.id ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{c.nombre}</span>
                      </CommandItem>
                    ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">
        {esProspecto ? (
          <>
            Sólo aparecen prospectos calificados.{" "}
            <Link to="/crm/prospectos" className="inline-flex items-center gap-1 underline">
              Ver prospectos <ExternalLink className="h-3 w-3" />
            </Link>
          </>
        ) : (
          <>
            Clientes ya dados de alta con RFC y régimen fiscal.{" "}
            <Link to="/clientes" className="inline-flex items-center gap-1 underline">
              Ver clientes <ExternalLink className="h-3 w-3" />
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
