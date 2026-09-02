/**
 * Renglón editable de la vista previa de conceptos extraídos por IA (v13.823.21).
 * Sólo se usa cuando el documento vino de un PDF procesado con IA: permite
 * corregir la descripción, cantidad, importe e IVA, o borrar el renglón de más.
 */
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { parseMonto } from "@/lib/format/parseMonto";
import { totalLinea } from "@/features/cxp/utils/cuadreConceptos";
import { totalLineaConImpuestos, type LineaConceptoResumen } from "@/features/cxp/utils/resumenConceptos";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

interface Props {
  indice: number;
  concepto: CfdiConceptoParsed;
  linea: LineaConceptoResumen;
  moneda: string;
  hayIeps: boolean;
  onEditar: (patch: Partial<CfdiConceptoParsed>) => void;
  onEliminar: () => void;
}

const fmt2 = (n: number | null | undefined) => (Number(n) || 0).toFixed(2);

export function CfdiConceptoIaRow({
  indice, concepto, linea, moneda, hayIeps, onEditar, onEliminar,
}: Props) {
  const [cantidadTxt, setCantidadTxt] = useState(String(linea.cantidad));
  const [importeTxt, setImporteTxt] = useState(fmt2(linea.monto));
  const [ivaTxt, setIvaTxt] = useState(fmt2(linea.iva));

  // v13.823.33: al borrar un renglón, React reutiliza esta instancia para el
  // renglón que ocupa ahora el mismo índice. Sin esta resincronización los
  // recuadros conservaban los importes del renglón eliminado (y al salir del
  // campo los volvían a guardar). Sólo se reescribe el texto cuando el valor
  // capturado difiere realmente del dato, así no estorba mientras se escribe.
  useEffect(() => {
    if (parseMonto(cantidadTxt, 1, { puntoDeMiles: false }) !== Number(linea.cantidad)) {
      setCantidadTxt(String(linea.cantidad));
    }
  }, [linea.cantidad, cantidadTxt]);

  useEffect(() => {
    if (parseMonto(importeTxt, 0) !== Number(linea.monto)) setImporteTxt(fmt2(linea.monto));
  }, [linea.monto, importeTxt]);

  useEffect(() => {
    if (parseMonto(ivaTxt, 0) !== Number(linea.iva)) setIvaTxt(fmt2(linea.iva));
  }, [linea.iva, ivaTxt]);

  return (
    <TableRow className="border-t odd:bg-background even:bg-muted/20 align-top">
      <TableCell className="text-muted-foreground">{indice + 1}</TableCell>
      <TableCell className="min-w-[220px]">
        <Input
          className="h-9"
          value={concepto.descripcion}
          placeholder="Descripción del servicio"
          aria-label={`Descripción del concepto ${indice + 1}`}
          onChange={(e) => onEditar({ descripcion: e.target.value })}
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          className="h-9 w-16 text-right tabular-nums"
          inputMode="decimal"
          value={cantidadTxt}
          aria-label={`Cantidad del concepto ${indice + 1}`}
          onChange={(e) => {
            setCantidadTxt(e.target.value);
            // La cantidad no es dinero: "1.500" son 1.5 unidades, no 1,500.
            onEditar({ cantidad: parseMonto(e.target.value, 1, { puntoDeMiles: false }) });
          }}
          onBlur={() => setCantidadTxt(String(parseMonto(cantidadTxt, 1, { puntoDeMiles: false }) || 1))}
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          className="h-9 w-28 text-right tabular-nums"
          inputMode="decimal"
          value={importeTxt}
          aria-label={`Importe unitario del concepto ${indice + 1}`}
          onChange={(e) => {
            setImporteTxt(e.target.value);
            onEditar({ importe: parseMonto(e.target.value, 0) });
          }}
          onBlur={() => setImporteTxt(fmt2(parseMonto(importeTxt, 0)))}
        />
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {formatCurrency(totalLinea(linea), moneda)}
      </TableCell>
      <TableCell className="text-right">
        <Input
          className="h-9 w-24 text-right tabular-nums"
          inputMode="decimal"
          value={ivaTxt}
          aria-label={`IVA del concepto ${indice + 1}`}
          onChange={(e) => {
            setIvaTxt(e.target.value);
            onEditar({ iva: parseMonto(e.target.value, 0) });
          }}
          onBlur={() => setIvaTxt(fmt2(parseMonto(ivaTxt, 0)))}
        />
      </TableCell>
      {hayIeps && (
        <TableCell className="text-right whitespace-nowrap">
          {formatCurrency(Number(linea.ieps) || 0, moneda)}
        </TableCell>
      )}
      <TableCell className="text-right font-semibold whitespace-nowrap">
        {formatCurrency(totalLineaConImpuestos(linea), moneda)}
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label={`Eliminar concepto ${indice + 1}`}
          onClick={onEliminar}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
