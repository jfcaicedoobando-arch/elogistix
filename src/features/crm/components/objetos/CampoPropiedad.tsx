/**
 * Captura de un valor de propiedad según su tipo. Guarda al salir del campo
 * (texto/número/fecha) o al elegir (listas).
 */
import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { idVigente, type PropiedadCrm } from "@/features/crm/services/propiedadesCrm";
import type { ValorCrm, ValorEntrada } from "@/features/crm/services/valoresCrm";

const NINGUNA = "ninguna";

interface Props {
  prop: PropiedadCrm;
  valor?: ValorCrm & { updated_at?: string };
  disabled: boolean;
  conflicto?: boolean;
  consultando?: boolean;
  onGuardar: (v: ValorEntrada, version: string | null) => void | Promise<boolean>;
  onEditar?: (tieneCambios: boolean) => void;
  descripcionId?: string;
  renderEstado?: (valorVisible: ValorEntrada) => ReactNode;
}

function inicialTexto(prop: PropiedadCrm, v?: ValorCrm): string {
  if (!v) return "";
  if (prop.tipo === "numero") return v.valor_numero?.toString() ?? "";
  if (prop.tipo === "fecha") return v.valor_fecha ?? "";
  return v.valor_texto ?? "";
}

export function CampoPropiedad(props: Props) {
  const { prop, valor, disabled, onGuardar, descripcionId, renderEstado } = props;
  const version = valor?.updated_at ?? null;
  const seleccionados = (valor?.opcion_ids ?? []).map((id) => idVigente(prop.opciones, id));
  const activas = prop.opciones.filter((o) => !o.archivada || seleccionados.includes(o.id));
  const id = `prop-${prop.id}`;

  if (prop.tipo === "seleccion") {
    return (
      <>
      <Select value={seleccionados[0] ?? NINGUNA} disabled={disabled}
        onValueChange={(v) => { void onGuardar(v === NINGUNA ? null : v, version); }}>
        <SelectTrigger id={id} aria-label={prop.etiqueta} aria-describedby={descripcionId}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NINGUNA}>Sin definir</SelectItem>
          {activas.map((o) => <SelectItem key={o.id} value={o.id}>{o.etiqueta}</SelectItem>)}
        </SelectContent>
      </Select>
      {renderEstado?.(seleccionados[0] ?? null)}
      </>
    );
  }

  if (prop.tipo === "multiseleccion") {
    const alternar = (opId: string, on: boolean) =>
      onGuardar(on ? [...seleccionados, opId] : seleccionados.filter((s) => s !== opId), version);
    return (
      <>
      <div className="flex flex-wrap gap-3" role="group" aria-label={prop.etiqueta} aria-describedby={descripcionId}>
        {activas.map((o) => (
          <label key={o.id} className="flex items-center gap-1.5 text-body-sm">
            <Checkbox checked={seleccionados.includes(o.id)} disabled={disabled}
              onCheckedChange={(c) => alternar(o.id, c === true)} />
            {o.etiqueta}
          </label>
        ))}
      </div>
      {renderEstado?.(seleccionados)}
      </>
    );
  }

  return <CampoCaptura {...props} />;
}

function CampoCaptura({ prop, valor, disabled, conflicto, consultando, onGuardar, onEditar, descripcionId, renderEstado }: Props) {
  const [borrador, setBorrador] = useState<{ texto: string; version: string | null } | null>(null);
  const actual = inicialTexto(prop, valor);
  const version = valor?.updated_at ?? null;
  const texto = borrador?.texto ?? actual;
  const hayConflicto = borrador !== null && (borrador.version !== version || conflicto);

  function editar(textoNuevo: string) {
    const tieneCambios = textoNuevo !== actual;
    setBorrador(tieneCambios ? { texto: textoNuevo, version: borrador ? borrador.version : version } : null);
    onEditar?.(tieneCambios);
  }

  async function guardar(versionObservada: string | null) {
    if (!borrador || disabled) return;
    const confirmado = await onGuardar(borrador.texto || null, versionObservada);
    if (confirmado !== false) setBorrador((previo) => previo === borrador ? null : previo);
  }

  const tipoInput = prop.tipo === "numero" ? "number" : prop.tipo === "fecha" ? "date" : "text";
  return (
    <>
    <Input
      id={`prop-${prop.id}`} type={tipoInput} value={texto} disabled={disabled} aria-label={prop.etiqueta}
      onChange={(e) => editar(e.target.value)}
      onBlur={() => { if (borrador && !hayConflicto) void guardar(borrador.version); }}
      aria-describedby={descripcionId}
      maxLength={prop.tipo === "texto" ? 500 : undefined}
    />
    {hayConflicto && (
      <div className="space-y-2 text-body-sm">
        <p role="status">Valor actual: {actual || "Sin definir"}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => editar(actual)}>
            Usar valor actual
          </Button>
          <Button type="button" size="sm" disabled={disabled || consultando} onClick={() => { void guardar(version); }}>
            Guardar mi cambio
          </Button>
        </div>
      </div>
    )}
    {renderEstado?.(texto)}
    </>
  );
}
