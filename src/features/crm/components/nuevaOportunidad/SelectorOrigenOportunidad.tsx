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
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandList,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProspectosForSelect } from "@/features/crm/hooks";
import { cn } from "@/lib/utils";
import { OpcionesProspecto, OpcionesCliente, AyudaOrigen } from "./SelectorOrigenOpciones";
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
                {esProspecto ? (
                  <OpcionesProspecto
                    prospectos={prospectos}
                    leadId={leadId}
                    onProspecto={(p) => { onProspecto(p); setOpen(false); }}
                  />
                ) : (
                  <OpcionesCliente
                    clientes={clientes}
                    clienteId={clienteId}
                    onCliente={(c) => { onCliente(c); setOpen(false); }}
                  />
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AyudaOrigen esProspecto={esProspecto} />
    </div>
  );
}
