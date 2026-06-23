/**
 * Formulario de alta/edición de tarifa marítima con sub-editor de recargos.
 * Todas las tarifas se capturan en USD (Fase 3).
 * Migrado a FormDialogShell (Ola 2 — Costeo).
 */
import { useEffect, useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { useCosteoRutas } from "@/features/costeo/hooks/useCosteoRutas";
import { useCosteoTarifaMutations } from "@/features/costeo/hooks/useCosteoTarifas";
import { useNavieras, useTiposContenedor } from "@/features/catalogos/hooks";
import { TarifaRecargosEditor } from "./TarifaRecargosEditor";
import {
  EntidadesFields, RutaTipoFields, NumerosFields, VigenciaFields,
} from "./TarifaFormFields";
import {
  buildInitialForm, calcularTotal, esFormValido, usdFormatter,
} from "./TarifaForm.helpers";
import type { TarifaInput, TarifaRecargoInput } from "@/features/costeo/services/tarifas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<TarifaInput>;
  tarifaId?: string;
  /** Si se provee, bloquea el Select de agente y oculta la lógica de selección manual. */
  agenteIdFijo?: string;
  /** Nombre del agente a mostrar como readonly cuando agenteIdFijo está presente. */
  agenteNombreFijo?: string;
  /** Override del título del modal (e.g. cuando es desde el portal del agente). */
  tituloOverride?: string;
  /** Rutas a usar en lugar de useCosteoRutas() (útil cuando no hay OrganizationContext). */
  rutasOverride?: Array<{ id: string; activa: boolean; puerto_origen_nombre?: string; puerto_destino_nombre?: string }>;
}

function calcularErrores(form: TarifaInput): Record<string, boolean> {
  return {
    agente_id: !form.agente_id,
    naviera_id: !form.naviera_id,
    ruta_id: !form.ruta_id,
    tipo_contenedor_id: !form.tipo_contenedor_id,
    flete_base: !(Number(form.flete_base) > 0),
    vigente_desde: !form.vigente_desde,
    vigente_hasta: !form.vigente_hasta,
  };
}

export function TarifaForm({ open, onOpenChange, initial, tarifaId, agenteIdFijo, agenteNombreFijo, tituloOverride, rutasOverride }: Props) {
  const { data: agentesData = [] } = useCosteoAgentes();
  const { data: rutasData = [] } = useCosteoRutas();
  const { data: navieras = [] } = useNavieras();
  const { data: tipos = [] } = useTiposContenedor();
  const { crear, actualizar } = useCosteoTarifaMutations();
  const agentes = agentesData;
  const rutas = rutasOverride ?? rutasData;

  const [form, setForm] = useState<TarifaInput>(() =>
    buildInitialForm(agenteIdFijo ? { ...initial, agente_id: agenteIdFijo } : initial),
  );
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(agenteIdFijo ? { ...initial, agente_id: agenteIdFijo } : initial));
      setIntentoEnvio(false);
    }
  }, [open, initial, agenteIdFijo]);

  const total = useMemo(() => calcularTotal(form), [form]);
  const valido = esFormValido(form);
  const esEdicion = Boolean(tarifaId);
  const pendiente = crear.isPending || actualizar.isPending;
  const errores = intentoEnvio ? calcularErrores(form) : undefined;

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!valido) return;
    if (esEdicion && tarifaId) {
      actualizar.mutate(
        { id: tarifaId, input: form },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      crear.mutate(form, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Tag}
      title={tituloOverride ?? (esEdicion ? "Editar tarifa marítima (USD)" : "Nueva tarifa marítima (USD)")}
      description="Captura o edita la tarifa marítima con sus costos y condiciones."
      size="2xl"
      headerAside={
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total comparable</div>
          <div className="text-lg font-semibold text-foreground tabular-nums">{usdFormatter(total)}</div>
        </div>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="tarifa-form" disabled={pendiente}>
            {pendiente ? "Guardando…" : esEdicion ? "Guardar cambios" : "Guardar tarifa"}
          </Button>
        </>
      }
    >
      <form id="tarifa-form" onSubmit={guardar} className="space-y-4">
        <EntidadesFields form={form} setForm={setForm} agentes={agentes} navieras={navieras} errores={errores} agenteIdFijo={agenteIdFijo} agenteNombreFijo={agenteNombreFijo} />
        <RutaTipoFields form={form} setForm={setForm} rutas={rutas} tipos={tipos} errores={errores} />
        <NumerosFields form={form} setForm={setForm} errores={errores} />
        <VigenciaFields form={form} setForm={setForm} errores={errores} />

        <TarifaRecargosEditor
          value={form.recargos}
          onChange={(recargos: TarifaRecargoInput[]) => setForm({ ...form, recargos })}
        />

        <div>
          <Label htmlFor="tarifa-notas">Notas</Label>
          <Textarea
            id="tarifa-notas"
            value={form.notas ?? ""}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            placeholder="Condiciones, restricciones, comentarios del agente…"
          />
        </div>
      </form>
    </FormDialogShell>
  );
}
