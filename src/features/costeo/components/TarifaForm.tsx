/**
 * Formulario de alta de tarifa marítima con sub-editor de recargos.
 * Todas las tarifas se capturan en USD (Fase 3).
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { useCosteoRutas } from "@/features/costeo/hooks/useCosteoRutas";
import { useCosteoTarifaMutations } from "@/features/costeo/hooks/useCosteoTarifas";
import { useNavieras, useTiposContenedor } from "@/hooks/catalogos";
import { TarifaRecargosEditor } from "./TarifaRecargosEditor";
import type { TarifaInput, TarifaRecargoInput } from "@/features/costeo/services/tarifas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<TarifaInput>;
}

const usd = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" }).format(n);

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const TARIFA_DEFAULTS: TarifaInput = {
  agente_id: "", naviera_id: "", ruta_id: "", tipo_contenedor_id: "",
  flete_base: 0, dias_libres_demoras: 7,
  vigente_desde: "", vigente_hasta: "",
  transit_time_dias: null, notas: "", recargos: [],
};

function buildInitialForm(initial?: Partial<TarifaInput>): TarifaInput {
  const base: TarifaInput = {
    ...TARIFA_DEFAULTS,
    vigente_desde: todayISO(),
    vigente_hasta: plusDays(30),
  };
  return { ...base, ...(initial ?? {}) };
}

function calcularTotal(form: TarifaInput): number {
  const rec = form.recargos
    .filter((r) => r.incluido_en_total !== false)
    .reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
  return (Number(form.flete_base) || 0) + rec;
}

function esFormValido(form: TarifaInput): boolean {
  if (!form.agente_id || !form.naviera_id || !form.ruta_id || !form.tipo_contenedor_id) return false;
  if (form.flete_base <= 0) return false;
  return form.vigente_desde <= form.vigente_hasta;
}

interface CatalogosRow { id: string; name?: string; nombre?: string; activo?: boolean; activa?: boolean }

interface PartialEntidadesProps {
  form: TarifaInput;
  setForm: (f: TarifaInput) => void;
  agentes: CatalogosRow[];
  navieras: CatalogosRow[];
}

function EntidadesFields({ form, setForm, agentes, navieras }: PartialEntidadesProps) {
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

function RutaTipoFields({ form, setForm, rutas, tipos }: RutaTipoProps) {
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

function NumerosFields({ form, setForm }: NumerosProps) {
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

function VigenciaFields({ form, setForm }: NumerosProps) {
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

export function TarifaForm({ open, onOpenChange, initial }: Props) {
  const { data: agentes = [] } = useCosteoAgentes();
  const { data: rutas = [] } = useCosteoRutas();
  const { data: navieras = [] } = useNavieras();
  const { data: tipos = [] } = useTiposContenedor();
  const { crear } = useCosteoTarifaMutations();

  const [form, setForm] = useState<TarifaInput>(() => buildInitialForm(initial));

  const total = useMemo(() => calcularTotal(form), [form]);
  const valido = esFormValido(form);

  const guardar = async () => {
    if (!valido) return;
    await crear.mutateAsync(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-2xl", scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>Nueva tarifa marítima (USD)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <EntidadesFields form={form} setForm={setForm} agentes={agentes} navieras={navieras} />
          <RutaTipoFields form={form} setForm={setForm} rutas={rutas} tipos={tipos} />
          <NumerosFields form={form} setForm={setForm} />
          <VigenciaFields form={form} setForm={setForm} />

          <TarifaRecargosEditor
            value={form.recargos}
            onChange={(recargos: TarifaRecargoInput[]) => setForm({ ...form, recargos })}
          />

          <div>
            <Label>Notas</Label>
            <Textarea value={form.notas ?? ""}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Condiciones, restricciones, comentarios del agente…" />
          </div>

          <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border">
            <span className="text-sm text-muted-foreground">Total comparable (flete + recargos)</span>
            <span className="text-lg font-semibold text-foreground">{usd(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={!valido || crear.isPending}>
            {crear.isPending ? "Guardando…" : "Guardar tarifa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
