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
}

export function EntidadesFields({ form, setForm, agentes, navieras }: EntidadesProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Agente *</Label>
        <Select value={form.agente_id} onValueChange={(v) => setForm({ ...form, agente_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecciona agente" /></SelectTrigger>
          <SelectContent>
            {agentes.filter((a) => a.activo).map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Naviera *</Label>
        <Select value={form.naviera_id} onValueChange={(v) => setForm({ ...form, naviera_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecciona naviera" /></SelectTrigger>
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
}

export function RutaTipoFields({ form, setForm, rutas, tipos }: RutaTipoProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Ruta *</Label>
        <Select value={form.ruta_id} onValueChange={(v) => setForm({ ...form, ruta_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecciona ruta" /></SelectTrigger>
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
        <Label>Tipo de contenedor *</Label>
        <Select value={form.tipo_contenedor_id} onValueChange={(v) => setForm({ ...form, tipo_contenedor_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
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

interface NumerosProps { form: TarifaInput; setForm: (f: TarifaInput) => void }

export function NumerosFields({ form, setForm }: NumerosProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <Label>Flete base USD *</Label>
        <Input type="number" min={0} step="0.01" value={form.flete_base}
          onChange={(e) => setForm({ ...form, flete_base: Number(e.target.value) || 0 })} />
      </div>
      <div>
        <Label>Días libres demoras</Label>
        <Input type="number" min={0} value={form.dias_libres_demoras}
          onChange={(e) => setForm({ ...form, dias_libres_demoras: Number(e.target.value) || 0 })} />
      </div>
      <div>
        <Label>Tránsito (días)</Label>
        <Input type="number" min={0} value={form.transit_time_dias ?? ""}
          onChange={(e) => setForm({ ...form, transit_time_dias: e.target.value ? Number(e.target.value) : null })} />
      </div>
    </div>
  );
}

export function VigenciaFields({ form, setForm }: NumerosProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Vigente desde *</Label>
        <Input type="date" value={form.vigente_desde}
          onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })} />
      </div>
      <div>
        <Label>Vigente hasta *</Label>
        <Input type="date" value={form.vigente_hasta}
          onChange={(e) => setForm({ ...form, vigente_hasta: e.target.value })} />
      </div>
    </div>
  );
}
