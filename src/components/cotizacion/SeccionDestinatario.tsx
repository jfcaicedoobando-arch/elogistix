import { useState, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import { useDebounce } from "@/hooks/shared/useDebounce";
import { useCrmProspectoSearch, type ProspectoMatch } from "@/hooks/crm/useCrmProspectoSearch";
import { Briefcase, UserRound, X, Info, Search } from "lucide-react";
import type { CotizacionFormValues } from "@/hooks/cotizacion";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  clientes: ClienteOption[];
}

export default function SeccionDestinatario({ clientes }: Props) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  const esProspecto = watch("esProspecto");
  const clienteId = watch("clienteId");
  const prospectoModo = watch("prospectoModo");
  const oportunidadId = watch("oportunidadId");
  const leadId = watch("leadId");
  const prospectoEmpresa = watch("prospectoEmpresa");

  const tieneVinculo = Boolean(oportunidadId || leadId);

  const setProspectoMode = (modo: "vincular" | "nuevo") => {
    setValue("prospectoModo", modo, { shouldDirty: true });
    if (modo === "nuevo") {
      setValue("oportunidadId", "", { shouldDirty: true });
      setValue("leadId", "", { shouldDirty: true });
    }
  };

  const handleSelectMatch = (m: ProspectoMatch) => {
    if (m.kind === "oportunidad") {
      setValue("oportunidadId", m.id, { shouldDirty: true });
      setValue("leadId", m.leadId ?? "", { shouldDirty: true });
    } else {
      setValue("leadId", m.id, { shouldDirty: true });
      setValue("oportunidadId", "", { shouldDirty: true });
    }
    setValue("prospectoEmpresa", m.empresa, { shouldDirty: true });
    setValue("prospectoContacto", m.contacto, { shouldDirty: true });
    setValue("prospectoEmail", m.email, { shouldDirty: true });
    setValue("prospectoTelefono", m.telefono, { shouldDirty: true });
  };

  const handleDesvincular = () => {
    setValue("oportunidadId", "", { shouldDirty: true });
    setValue("leadId", "", { shouldDirty: true });
  };

  return (
    <WizardSection title="Destinatario">
      <RadioGroup
        value={esProspecto ? "prospecto" : "cliente"}
        onValueChange={(v) => setValue("esProspecto", v === "prospecto")}
        className="flex gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="cliente" id="dest-cliente" />
          <Label htmlFor="dest-cliente" className="cursor-pointer text-sm font-medium">
            Cliente existente
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="prospecto" id="dest-prospecto" />
          <Label htmlFor="dest-prospecto" className="cursor-pointer text-sm font-medium">
            Prospecto
          </Label>
        </div>
      </RadioGroup>

      {!esProspecto ? (
        <FormField label="Cliente" required>
          <Select value={clienteId} onValueChange={(v) => setValue("clienteId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : (
        <ProspectoSection
          modo={prospectoModo}
          onChangeModo={setProspectoMode}
          tieneVinculo={tieneVinculo}
          oportunidadId={oportunidadId}
          leadId={leadId}
          prospectoEmpresa={prospectoEmpresa}
          onSelectMatch={handleSelectMatch}
          onDesvincular={handleDesvincular}
        />
      )}
    </WizardSection>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ────────────────────────────────────────────────────────────────────────────

interface ProspectoSectionProps {
  modo: "vincular" | "nuevo";
  onChangeModo: (m: "vincular" | "nuevo") => void;
  tieneVinculo: boolean;
  oportunidadId: string;
  leadId: string;
  prospectoEmpresa: string;
  onSelectMatch: (m: ProspectoMatch) => void;
  onDesvincular: () => void;
}

function ProspectoSection({
  modo,
  onChangeModo,
  tieneVinculo,
  oportunidadId,
  leadId,
  prospectoEmpresa,
  onSelectMatch,
  onDesvincular,
}: ProspectoSectionProps) {
  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
      <RadioGroup
        value={modo}
        onValueChange={(v) => onChangeModo(v as "vincular" | "nuevo")}
        className="flex flex-col gap-2 sm:flex-row sm:gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="vincular" id="modo-vincular" />
          <Label htmlFor="modo-vincular" className="cursor-pointer text-sm font-medium">
            Vincular a lead u oportunidad existente
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="nuevo" id="modo-nuevo" />
          <Label htmlFor="modo-nuevo" className="cursor-pointer text-sm font-medium">
            Crear nuevo prospecto
          </Label>
        </div>
      </RadioGroup>

      {modo === "vincular" ? (
        tieneVinculo ? (
          <VinculoChip
            oportunidadId={oportunidadId}
            leadId={leadId}
            nombre={prospectoEmpresa}
            onDesvincular={onDesvincular}
          />
        ) : (
          <BuscadorProspectos onSelect={onSelectMatch} />
        )
      ) : (
        <FormularioNuevoProspecto />
      )}
    </div>
  );
}

function VinculoChip({
  oportunidadId,
  leadId,
  nombre,
  onDesvincular,
}: {
  oportunidadId: string;
  leadId: string;
  nombre: string;
  onDesvincular: () => void;
}) {
  const tipoLabel = oportunidadId ? "Oportunidad" : "Lead";
  const Icon = oportunidadId ? Briefcase : UserRound;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <Badge variant="outline" className="border-primary/40 text-primary">
          {tipoLabel}
        </Badge>
        <span className="truncate text-sm font-medium">{nombre || "Sin nombre"}</span>
        {!oportunidadId && leadId && (
          <span className="text-xs text-muted-foreground">
            (se creará la oportunidad al guardar)
          </span>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onDesvincular}>
        <X className="h-4 w-4 mr-1" /> Desvincular
      </Button>
    </div>
  );
}

function BuscadorProspectos({ onSelect }: { onSelect: (m: ProspectoMatch) => void }) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 200);
  const { data, isFetching } = useCrmProspectoSearch(debounced);

  const items = useMemo(() => data ?? [], [data]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por empresa, contacto, email…"
          className="pl-8"
          autoFocus
        />
      </div>
      {debounced.length < 2 ? (
        <p className="text-xs text-muted-foreground">
          Escribe al menos 2 caracteres para buscar.
        </p>
      ) : isFetching ? (
        <p className="text-xs text-muted-foreground">Buscando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sin resultados. Cambia el modo a "Crear nuevo prospecto" para registrarlo.
        </p>
      ) : (
        <ul className="max-h-60 overflow-auto rounded-md border bg-background divide-y">
          {items.map((m) => (
            <li key={`${m.kind}-${m.id}`}>
              <button
                type="button"
                onClick={() => onSelect(m)}
                className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted/60"
              >
                <Badge
                  variant="outline"
                  className={
                    m.kind === "oportunidad"
                      ? "border-primary/40 text-primary"
                      : "border-muted-foreground/40"
                  }
                >
                  {m.kind === "oportunidad" ? "Oport." : "Lead"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.empresa}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.contacto || m.email || "—"}
                    {m.etapaNombre ? ` · ${m.etapaNombre}` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormularioNuevoProspecto() {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-3 text-xs">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          Al guardar la cotización se creará automáticamente un <strong>lead</strong> y
          una <strong>oportunidad</strong> en el CRM (etapa "Cotizando").
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Nombre de Empresa" required>
          <Input
            value={watch("prospectoEmpresa")}
            onChange={(e) => setValue("prospectoEmpresa", e.target.value)}
            placeholder="Ej. Importaciones ABC"
          />
        </FormField>
        <FormField label="Nombre de Contacto" required>
          <Input
            value={watch("prospectoContacto")}
            onChange={(e) => setValue("prospectoContacto", e.target.value)}
            placeholder="Ej. Juan Pérez"
          />
        </FormField>
        <FormField label="Email">
          <Input
            type="email"
            value={watch("prospectoEmail")}
            onChange={(e) => setValue("prospectoEmail", e.target.value)}
            placeholder="contacto@empresa.com"
          />
        </FormField>
        <FormField label="Teléfono">
          <Input
            value={watch("prospectoTelefono")}
            onChange={(e) => setValue("prospectoTelefono", e.target.value)}
            placeholder="+52 55 1234 5678"
          />
        </FormField>
      </div>
    </div>
  );
}
