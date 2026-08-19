import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCurrency } from "@/lib/formatters";
import type { Tables } from "@/types/db";
import type { TotalesProforma } from "./PasoSeleccionConceptos";


type ConceptoVenta = Tables<"conceptos_venta">;

interface ConceptoRowProps {
  c: ConceptoVenta;
  isSelected: boolean;
  ivaActivo: boolean;
  ivaBloqueado: boolean;
  contLabel: string | null;
  showGeneralBadge: boolean;
  onToggle: (id: string) => void;
  onToggleIva: (id: string, moneda: string) => void;
}

export function ConceptoRow({
  c, isSelected, ivaActivo, ivaBloqueado, contLabel, showGeneralBadge,
  onToggle, onToggleIva,
}: ConceptoRowProps) {
  const sub = Number(c.cantidad) * Number(c.precio_unitario);
  return (
    <div className="flex items-start gap-3 p-3 hover:bg-muted/30">
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(c.id)}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-body">{c.descripcion}</span>
          <Badge variant="outline" className="text-body-sm">{c.moneda}</Badge>
          {contLabel && (
            <Badge variant="secondary" className="text-body-sm">Cont. {contLabel}</Badge>
          )}
          {showGeneralBadge && (
            <Badge variant="outline" className="text-body-sm text-muted-foreground">General</Badge>
          )}
        </div>
        <div className="text-body-sm text-muted-foreground mt-0.5">
          {c.cantidad} × {formatCurrency(Number(c.precio_unitario), c.moneda)} = {formatCurrency(sub, c.moneda)}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {ivaBloqueado ? (
          // B-051 (v13.320.48): en conceptos MXN el IVA es obligatorio por ley.
          // Antes se mostraba un Switch deshabilitado que parecía "apagado" pero
          // el sistema sí cobraba IVA — confundía al operador. Ahora se muestra
          // un badge informativo "IVA incluido" y desaparece el toggle.
          <Badge variant="secondary" className="text-body-sm">IVA 16% incluido</Badge>
        ) : (
          <div className="flex items-center gap-2">
            <Label size="sm" htmlFor={`iva-${c.id}`} className="text-muted-foreground cursor-pointer">
              IVA
            </Label>
            <Switch
              id={`iva-${c.id}`}
              checked={ivaActivo}
              onCheckedChange={() => onToggleIva(c.id, c.moneda)}
              disabled={!isSelected}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface TotalesProps {
  totales: TotalesProforma;
  tasaIva: number;
  seleccionadosVisibles: number;
}

export function TotalesProformaBox({ totales, tasaIva, seleccionadosVisibles }: TotalesProps) {
  return (
    <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
      <SectionHeading as="h3" variant="subsection" className="mb-2">Totales de la Proforma</SectionHeading>
      {totales.subtotal_usd > 0 && (
        <div className="space-y-1 text-body">
          <div className="flex justify-between"><span>Subtotal USD:</span><span>{formatCurrency(totales.subtotal_usd, "USD")}</span></div>
          {totales.iva_usd > 0 && (
            <div className="flex justify-between text-muted-foreground"><span>IVA USD:</span><span>{formatCurrency(totales.iva_usd, "USD")}</span></div>
          )}
          <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total USD:</span><span>{formatCurrency(totales.total_usd, "USD")}</span></div>
        </div>
      )}
      {totales.subtotal_mxn > 0 && (
        <div className={`space-y-1 text-body ${totales.subtotal_usd > 0 ? "mt-3 pt-3 border-t" : ""}`}>
          <div className="flex justify-between"><span>Subtotal MXN:</span><span>{formatCurrency(totales.subtotal_mxn, "MXN")}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>IVA ({(tasaIva * 100).toFixed(0)}%) MXN:</span><span>{formatCurrency(totales.iva_mxn, "MXN")}</span></div>
          <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total MXN:</span><span>{formatCurrency(totales.total_mxn, "MXN")}</span></div>
        </div>
      )}
      {seleccionadosVisibles === 0 && (
        <p className="text-body text-muted-foreground text-center py-2">Selecciona al menos un concepto</p>
      )}
    </div>
  );
}

interface FooterFieldsProps {
  notas: string;
  onNotasChange: (v: string) => void;
}

export function ProformaFooterFields({ notas, onNotasChange }: FooterFieldsProps) {
  return (
    <div>
      <Label htmlFor="notas" className="text-body">Notas (opcional)</Label>
      <Textarea
        id="notas"
        value={notas}
        onChange={(e) => onNotasChange(e.target.value)}
        placeholder="Notas adicionales para esta proforma..."
        rows={2}
        className="mt-1"
      />
    </div>
  );
}


