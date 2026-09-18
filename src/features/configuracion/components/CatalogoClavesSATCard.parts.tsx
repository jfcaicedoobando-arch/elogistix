/**
 * Sub-componente `EditRow` del Catálogo de productos y servicios.
 * Aislado en su propio `.tsx` (sólo exporta componentes) para cumplir con
 * la regla `react-refresh/only-export-components`.
 */
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell } from "@/components/ui/table";
import { DetailTableRow } from "@/components/shared/DetailTable";
import { TIPO_IVA_AYUDA, TIPO_IVA_AYUDA_GENERAL } from "@/lib/financial/tipoIvaSat";
import {
  UNIDADES_SAT, TIPO_IVA_OPCIONES_CATALOGO, type Draft, type TipoIva,
} from "./CatalogoClavesSATCard.constants";


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
    <DetailTableRow className="bg-muted/30" hoverable={false}>
      <TableCell><Input aria-label="Patrón de descripción" value={draft.patron} onChange={(e) => p({ patron: e.target.value })} placeholder="Flete Marítimo" /></TableCell>
      <TableCell><Input aria-label="Clave SAT" value={draft.clave_sat} onChange={(e) => p({ clave_sat: e.target.value })} placeholder="78101800" /></TableCell>
      <TableCell>
        <Select value={draft.tipo_iva} onValueChange={(v) => p({ tipo_iva: v as TipoIva })}>
          <SelectTrigger aria-label="Tratamiento de IVA"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPO_IVA_OPCIONES_CATALOGO.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <span className="flex flex-col">
                  <span>{o.label}</span>
                  <span className="text-label text-muted-foreground">{TIPO_IVA_AYUDA[o.value]}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* P2-IVA: ayuda breve para no confundir tasa 0%, exento y no objeto. */}
        <p className="mt-1 text-label text-muted-foreground">{TIPO_IVA_AYUDA_GENERAL}</p>
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
      <TableCell><Switch checked={draft.activo} onCheckedChange={(v) => p({ activo: v })} aria-label="Producto activo" /></TableCell>
      <TableCell className="text-right">
        <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy} aria-label="Cancelar edición"><X className="h-4 w-4" /></Button>
        <Button size="icon" onClick={onSave} disabled={busy || !valid} aria-label="Guardar producto"><Check className="h-4 w-4" /></Button>
      </TableCell>
    </DetailTableRow>
  );
}
