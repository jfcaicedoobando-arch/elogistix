/**
 * v13.47.0 — Resumen de los datos operativos que se HEREDAN de la tarifa
 * vinculada a la cotización (tránsito, frecuencia, días libres, carta
 * garantía, demoras). Ventas los visualiza en modo lectura; sólo los roles
 * con `canOverrideTarifaPricing` pueden activar el modo "Editar manual".
 *
 * Encapsula la lectura del estado del formulario para mantener
 * `TarifaVinculadaPanel` ≤200 líneas.
 */
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Pencil, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeredadoBadge } from "@/components/shared/HeredadoBadge";
import CartaGarantiaBadge from "./CartaGarantiaBadge";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { marcarOverride, OPTS } from "./seccionRuta/overrideHelpers";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";

interface Props {
  tarifa: TopTarifaRow;
}

interface Row { label: string; value: string; chip?: React.ReactNode; mostrar: boolean; }

function ValueOrPlaceholder({ value }: { value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">No definido en la tarifa</span>;
  }
  return <span className="font-medium">{value}</span>;
}

export default function TarifaResumenHeredado({ tarifa }: Props) {
  const { canOverrideTarifaPricing } = usePermissions();
  const form = useFormContext<CotizacionFormValues>();
  const { watch, getValues } = form;
  const [editMode, setEditMode] = useState(false);

  const tipoEmbarque = watch("tipoEmbarque");
  const esFCL = tipoEmbarque === "FCL";
  const esLCL = tipoEmbarque === "LCL";

  // Valores actuales del form (post-aplicación de la tarifa o post-override).
  const transito = watch("tiempoTransitoDias");
  const frecuencia = watch("frecuencia");
  const diasLibres = watch("diasLibresDestino");
  const diasAlmacenaje = watch("diasAlmacenaje");

  const override = getValues("tarifaOverride") ?? {};

  const rows: Row[] = [
    {
      label: "Tiempo de tránsito",
      value: transito != null ? `${transito} días` : "",
      mostrar: true,
    },
    {
      label: "Frecuencia",
      value: frecuencia ?? "",
      mostrar: true,
    },
    {
      label: "Días libres en destino (demoras)",
      value: diasLibres != null ? `${diasLibres} días` : "",
      mostrar: esFCL,
    },
    {
      label: "Días libres de almacenaje",
      value: diasAlmacenaje != null ? `${diasAlmacenaje} días` : "",
      mostrar: esLCL,
    },
    {
      label: "Carta garantía",
      value: "",
      chip: <CartaGarantiaBadge tarifa={tarifa} />,
      mostrar: esFCL,
    },
  ].filter(r => r.mostrar);

  return (
    <div className="rounded-md border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Detalles operativos heredados de la tarifa
        </div>
        {canOverrideTarifaPricing ? (
          <Button
            type="button" size="sm" variant="ghost"
            onClick={() => setEditMode(v => !v)}
            className="text-xs"
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {editMode ? "Bloquear" : "Editar manual"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Info className="h-3.5 w-3.5" /> Solo lectura
          </span>
        )}
      </div>

      {!editMode ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between gap-2 min-w-0">
              <dt className="text-muted-foreground shrink-0">{r.label}</dt>
              <dd className="flex items-center gap-2 min-w-0">
                {r.chip ?? <ValueOrPlaceholder value={r.value} />}
                <HeredadoBadge tipoOrigen="tarifa" origen="vinculada" className="shrink-0" />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <EditMode
          form={form}
          tipoEmbarque={tipoEmbarque}
          transito={transito}
          frecuencia={frecuencia}
          diasLibres={diasLibres}
          diasAlmacenaje={diasAlmacenaje}
          override={override}
        />
      )}
    </div>
  );
}

interface EditModeProps {
  form: ReturnType<typeof useFormContext<CotizacionFormValues>>;
  tipoEmbarque: string | undefined;
  transito: number | undefined;
  frecuencia: string | undefined;
  diasLibres: number | undefined;
  diasAlmacenaje: number | undefined;
  override: Record<string, unknown>;
}

function EditMode({ form, tipoEmbarque, transito, frecuencia, diasLibres, diasAlmacenaje, override }: EditModeProps) {
  const { watch, setValue } = form;
  const esFCL = tipoEmbarque === "FCL";
  const esLCL = tipoEmbarque === "LCL";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">Tiempo de tránsito (días)</span>
        <Input
          type="number" min={0}
          value={transito ?? ""}
          onChange={e => { marcarOverride(form, "tiempoTransitoDias"); setValue("tiempoTransitoDias", e.target.value ? Number(e.target.value) : undefined, OPTS); }}
        />
        {Boolean(override.tiempoTransitoDias) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
      </label>
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">Frecuencia</span>
        <Select value={frecuencia ?? ""} onValueChange={v => { marcarOverride(form, "frecuencia"); setValue("frecuencia", v, OPTS); }}>
          <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Diaria">Diaria</SelectItem>
            <SelectItem value="Semanal">Semanal</SelectItem>
            <SelectItem value="Quincenal">Quincenal</SelectItem>
            <SelectItem value="Mensual">Mensual</SelectItem>
            <SelectItem value="Bajo demanda">Bajo demanda</SelectItem>
          </SelectContent>
        </Select>
        {Boolean(override.frecuencia) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
      </label>
      {esFCL && (
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Días libres en destino (demoras)</span>
          <Input
            type="number" min={0}
            value={diasLibres ?? ""}
            onChange={e => { marcarOverride(form, "diasLibresDestino"); setValue("diasLibresDestino", Number(e.target.value), OPTS); }}
          />
          {Boolean(override.diasLibresDestino) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
        </label>
      )}
      {esLCL && (
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Días libres de almacenaje</span>
          <Input
            type="number" min={0}
            value={diasAlmacenaje ?? ""}
            onChange={e => { marcarOverride(form, "diasAlmacenaje"); setValue("diasAlmacenaje", Number(e.target.value), OPTS); }}
          />
          {Boolean(override.diasAlmacenaje) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
        </label>
      )}
      {esFCL && (
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Carta garantía</span>
          <Select value={watch("cartaGarantia") ? "si" : "no"} onValueChange={v => { marcarOverride(form, "cartaGarantia"); setValue("cartaGarantia", v === "si", OPTS); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="si">Sí</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          {Boolean(override.cartaGarantia) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
        </label>
      )}
    </div>
  );
}
