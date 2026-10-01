/**
 * Captura de un valor de propiedad según su tipo. Guarda al salir del campo
 * (texto/número/fecha) o al elegir (listas).
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { idVigente, type PropiedadCrm } from "@/features/crm/services/propiedadesCrm";
import type { ValorCrm, ValorEntrada } from "@/features/crm/services/valoresCrm";

const NINGUNA = "ninguna";

interface Props {
  prop: PropiedadCrm;
  valor?: ValorCrm;
  disabled: boolean;
  onGuardar: (v: ValorEntrada) => void;
}

function inicialTexto(prop: PropiedadCrm, v?: ValorCrm): string {
  if (!v) return "";
  if (prop.tipo === "numero") return v.valor_numero?.toString() ?? "";
  if (prop.tipo === "fecha") return v.valor_fecha ?? "";
  return v.valor_texto ?? "";
}

export function CampoPropiedad({ prop, valor, disabled, onGuardar }: Props) {
  const [texto, setTexto] = useState(() => inicialTexto(prop, valor));
  const seleccionados = (valor?.opcion_ids ?? []).map((id) => idVigente(prop.opciones, id));
  const activas = prop.opciones.filter((o) => !o.archivada || seleccionados.includes(o.id));
  const id = `prop-${prop.id}`;

  if (prop.tipo === "seleccion") {
    return (
      <Select value={seleccionados[0] ?? NINGUNA} disabled={disabled}
        onValueChange={(v) => onGuardar(v === NINGUNA ? null : v)}>
        <SelectTrigger id={id} aria-label={prop.etiqueta}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NINGUNA}>Sin definir</SelectItem>
          {activas.map((o) => <SelectItem key={o.id} value={o.id}>{o.etiqueta}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (prop.tipo === "multiseleccion") {
    const alternar = (opId: string, on: boolean) =>
      onGuardar(on ? [...seleccionados, opId] : seleccionados.filter((s) => s !== opId));
    return (
      <div className="flex flex-wrap gap-3" role="group" aria-label={prop.etiqueta}>
        {activas.map((o) => (
          <label key={o.id} className="flex items-center gap-1.5 text-body-sm">
            <Checkbox checked={seleccionados.includes(o.id)} disabled={disabled}
              onCheckedChange={(c) => alternar(o.id, c === true)} />
            {o.etiqueta}
          </label>
        ))}
      </div>
    );
  }

  const tipoInput = prop.tipo === "numero" ? "number" : prop.tipo === "fecha" ? "date" : "text";
  return (
    <Input
      id={id} type={tipoInput} value={texto} disabled={disabled} aria-label={prop.etiqueta}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { if (texto !== inicialTexto(prop, valor)) onGuardar(texto || null); }}
      maxLength={prop.tipo === "texto" ? 500 : undefined}
    />
  );
}
