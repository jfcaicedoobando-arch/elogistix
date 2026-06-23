/**
 * Sub-componentes de campos del formulario de tarifa marítima.
 * Extraídos de `TarifaForm.tsx` para cumplir Power-of-10 (≤200 líneas).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

interface CatalogosRow { id: string; name?: string; nombre?: string; activo?: boolean; activa?: boolean }

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

const noSpinnerCls =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

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
            <p className="text-[10px] text-muted-foreground mt-1">
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
}

export function RutaTipoFields({ form, setForm, rutas, tipos, errores }: RutaTipoProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="tarifa-ruta">Ruta *</Label>
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

interface NumerosProps { form: TarifaInput; setForm: (f: TarifaInput) => void; errores?: Record<string, boolean> }

export function NumerosFields({ form, setForm, errores }: NumerosProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <Label htmlFor="tarifa-flete">Flete base USD *</Label>
        <Input
          id="tarifa-flete"
          type="number" min={0} step="0.01" value={form.flete_base}
          aria-invalid={errores?.flete_base || undefined}
          className={`${invalidCls(errores?.flete_base) ?? ""} ${noSpinnerCls}`}
          onChange={(e) => setForm({ ...form, flete_base: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-dias-libres">Días libres demoras</Label>
        <Input
          id="tarifa-dias-libres"
          type="number" min={0} value={form.dias_libres_demoras}
          className={noSpinnerCls}
          onChange={(e) => setForm({ ...form, dias_libres_demoras: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-transito">Tránsito (días)</Label>
        <Input
          id="tarifa-transito"
          type="number" min={0} value={form.transit_time_dias ?? ""}
          className={noSpinnerCls}
          onChange={(e) => setForm({ ...form, transit_time_dias: e.target.value ? Number(e.target.value) : null })}
        />
      </div>
    </div>
  );
}

export function VigenciaFields({ form, setForm, errores }: NumerosProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="tarifa-vig-desde">Vigente desde *</Label>
        <Input
          id="tarifa-vig-desde"
          type="date" value={form.vigente_desde}
          aria-invalid={errores?.vigente_desde || undefined}
          className={invalidCls(errores?.vigente_desde)}
          onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-vig-hasta">Vigente hasta *</Label>
        <Input
          id="tarifa-vig-hasta"
          type="date" value={form.vigente_hasta}
          aria-invalid={errores?.vigente_hasta || undefined}
          className={invalidCls(errores?.vigente_hasta)}
          onChange={(e) => setForm({ ...form, vigente_hasta: e.target.value })}
        />
      </div>
    </div>
  );
}
