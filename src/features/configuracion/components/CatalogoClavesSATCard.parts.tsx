/**
 * Piezas auxiliares de `CatalogoClavesSATCard`: tipos, constantes de UI y
 * el sub-componente `EditRow`. Separado del contenedor para respetar el
 * límite de 200 líneas por archivo (Power of 10).
 */
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";

export type TipoIva = "gravado_16" | "tasa_0" | "exento";

export interface Row {
  id: string;
  organization_id: string;
  patron: string;
  clave_sat: string;
  prioridad: number;
  activo: boolean;
  notas: string | null;
  tipo_iva: TipoIva;
  clave_unidad_sat: string;
  nombre_unidad: string | null;
}

export interface Draft {
  patron: string;
  clave_sat: string;
  prioridad: number;
  activo: boolean;
  notas: string;
  tipo_iva: TipoIva;
  clave_unidad_sat: string;
}

export const EMPTY_DRAFT: Draft = {
  patron: "", clave_sat: "", prioridad: 100, activo: true, notas: "",
  tipo_iva: "gravado_16", clave_unidad_sat: "E48",
};

export const UNIDADES_SAT: Array<{ value: string; label: string }> = [
  { value: "E48", label: "E48 — Unidad de Servicio" },
  { value: "H87", label: "H87 — Pieza" },
  { value: "XPP", label: "XPP — Paquete" },
  { value: "KGM", label: "KGM — Kilogramo" },
  { value: "TNE", label: "TNE — Tonelada" },
  { value: "MTR", label: "MTR — Metro" },
  { value: "MTQ", label: "MTQ — Metro cúbico" },
  { value: "LTR", label: "LTR — Litro" },
  { value: "ACT", label: "ACT — Actividad" },
];

export const TIPO_IVA_LABEL: Record<TipoIva, string> = {
  gravado_16: "IVA 16%",
  tasa_0: "IVA 0%",
  exento: "Exento",
};

export const TIPO_IVA_VARIANT: Record<TipoIva, "default" | "secondary" | "outline"> = {
  gravado_16: "default",
  tasa_0: "secondary",
  exento: "outline",
};

export function tasaFromTipo(tipo: TipoIva): number | null {
  if (tipo === "gravado_16") return 0.16;
  if (tipo === "tasa_0") return 0;
  return null;
}

interface EditRowProps {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  valid: boolean;
}

export function EditRow({ draft, setDraft, onCancel, onSave, busy, valid }: EditRowProps) {
  const p = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  return (
    <TableRow className="bg-muted/30">
      <TableCell><Input value={draft.patron} onChange={(e) => p({ patron: e.target.value })} placeholder="Flete Marítimo" /></TableCell>
      <TableCell><Input value={draft.clave_sat} onChange={(e) => p({ clave_sat: e.target.value })} placeholder="78101800" /></TableCell>
      <TableCell>
        <Select value={draft.tipo_iva} onValueChange={(v) => p({ tipo_iva: v as TipoIva })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gravado_16">IVA 16%</SelectItem>
            <SelectItem value="tasa_0">IVA 0%</SelectItem>
            <SelectItem value="exento">Exento</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={draft.clave_unidad_sat} onValueChange={(v) => p({ clave_unidad_sat: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {UNIDADES_SAT.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell><Input type="number" min={1} value={draft.prioridad} onChange={(e) => p({ prioridad: Number(e.target.value) || 100 })} /></TableCell>
      <TableCell><Switch checked={draft.activo} onCheckedChange={(v) => p({ activo: v })} /></TableCell>
      <TableCell><Input value={draft.notas} onChange={(e) => p({ notas: e.target.value })} placeholder="opcional" /></TableCell>
      <TableCell className="text-right">
        <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy}><X className="h-4 w-4" /></Button>
        <Button size="icon" onClick={onSave} disabled={busy || !valid}><Check className="h-4 w-4" /></Button>
      </TableCell>
    </TableRow>
  );
}
