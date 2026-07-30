/**
 * Sub-componentes de campos del formulario de tarifa marítima.
 * Extraídos de `TarifaForm.tsx` para cumplir Power-of-10 (≤200 líneas).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import { MultiRutaSelect } from "./MultiRutaSelect";

interface CatalogosRow { id: string; name?: string; nombre?: string; activo?: boolean; activa?: boolean }

import { NavieraQuickCreate } from "./NavieraQuickCreate";

interface EntidadesProps {
  form: TarifaInput;
  setForm: (f: TarifaInput) => void;
  agentes: CatalogosRow[];
  navieras: CatalogosRow[];
  errores?: Record<string, boolean>;
  /** Si se provee, el Select de agente queda bloqueado (uso del portal del agente). */
  agenteIdFijo?: string;
  /** Nombre del agente a mostrar como readonly cuando agenteIdFijo está presente. */
  agenteNombreFijo?: string;
}

const invalidCls = (invalid?: boolean) =>
  invalid ? "border-destructive focus-visible:ring-destructive" : undefined;


export function EntidadesFields({ form, setForm, agentes, navieras, errores, agenteIdFijo, agenteNombreFijo }: EntidadesProps) {
  const agenteBloqueado = Boolean(agenteIdFijo);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="tarifa-agente">Agente *</Label>
        {agenteBloqueado ? (
          <>
            <Input
              id="tarifa-agente"
              value={agenteNombreFijo ?? agentes.find((a) => a.id === agenteIdFijo)?.nombre ?? "Tu agencia"}
              readOnly
              disabled
              className="bg-muted/40"
            />
            <p className="text-2xs text-muted-foreground mt-1">
              Las tarifas que captures quedan a tu nombre automáticamente.
            </p>
          </>
        ) : (
          <Select
            value={form.agente_id}
            onValueChange={(v) => setForm({ ...form, agente_id: v })}
          >
            <SelectTrigger
              id="tarifa-agente"
              aria-invalid={errores?.agente_id || undefined}
              className={invalidCls(errores?.agente_id)}
            >
              <SelectValue placeholder="Selecciona agente" />
            </SelectTrigger>
            <SelectContent>
              {agentes.filter((a) => a.activo).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label htmlFor="tarifa-naviera">Naviera *</Label>
        <Select value={form.naviera_id} onValueChange={(v) => setForm({ ...form, naviera_id: v })}>
          <SelectTrigger
            id="tarifa-naviera"
            aria-invalid={errores?.naviera_id || undefined}
            className={invalidCls(errores?.naviera_id)}
          >
            <SelectValue placeholder="Selecciona naviera" />
          </SelectTrigger>
          <SelectContent>
            {navieras.map((n) => (
              <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <NavieraQuickCreate onCreada={(id) => setForm({ ...form, naviera_id: id })} />
      </div>
    </div>
  );
}

interface RutaTipoProps {
  form: TarifaInput;
  setForm: (f: TarifaInput) => void;
  rutas: Array<{ id: string; activa: boolean; puerto_origen_nombre?: string; puerto_destino_nombre?: string }>;
  tipos: CatalogosRow[];
  errores?: Record<string, boolean>;
  /** Modo multi-ruta: 1 captura → N tarifas. Solo en alta/duplicado. */
  multiple?: boolean;
  rutaIds?: string[];
  onRutaIdsChange?: (ids: string[]) => void;
}

export function RutaTipoFields({
  form, setForm, rutas, tipos, errores, multiple, rutaIds, onRutaIdsChange,
}: RutaTipoProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="tarifa-ruta">{multiple ? "Rutas *" : "Ruta *"}</Label>
          {multiple && (rutaIds?.length ?? 0) > 1 && (
            <Badge variant="secondary" className="text-2xs">
              Se crearán {rutaIds?.length} tarifas
            </Badge>
          )}
        </div>
        {multiple ? (
          <>
            <MultiRutaSelect
              id="tarifa-ruta"
              rutas={rutas}
              value={rutaIds ?? []}
              onChange={(ids) => onRutaIdsChange?.(ids)}
              invalid={errores?.ruta_id}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tip: selecciona varias rutas para crear una tarifa en cada una con los mismos datos.
            </p>
          </>
        ) : (
          <Select value={form.ruta_id} onValueChange={(v) => setForm({ ...form, ruta_id: v })}>
            <SelectTrigger
              id="tarifa-ruta"
              aria-invalid={errores?.ruta_id || undefined}
              className={invalidCls(errores?.ruta_id)}
            >
              <SelectValue placeholder="Selecciona ruta" />
            </SelectTrigger>
            <SelectContent>
              {rutas.filter((r) => r.activa).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.puerto_origen_nombre} → {r.puerto_destino_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label htmlFor="tarifa-tipo">Tipo de contenedor *</Label>
        <Select value={form.tipo_contenedor_id} onValueChange={(v) => setForm({ ...form, tipo_contenedor_id: v })}>
          <SelectTrigger
            id="tarifa-tipo"
            aria-invalid={errores?.tipo_contenedor_id || undefined}
            className={invalidCls(errores?.tipo_contenedor_id)}
          >
            <SelectValue placeholder="Selecciona tipo" />
          </SelectTrigger>
          <SelectContent>
            {tipos.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// `NumerosFields` y `VigenciaFields` viven en archivo aparte para mantener
// este módulo ≤200 líneas (Power-of-10). Re-exportamos para compatibilidad
// con importadores existentes (`TarifaForm.tsx`).
export { NumerosFields, VigenciaFields } from "./TarifaNumerosVigenciaFields";
