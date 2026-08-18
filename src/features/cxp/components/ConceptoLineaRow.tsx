/**
 * Un renglón de la captura manual de conceptos de factura de proveedor
 * (v13.629.0). Maneja el texto local de los campos numéricos para poder
 * formatear al salir del campo (12 → 12.00) sin pelearse con el estado padre.
 */
import { useState } from "react";
import { Copy, Percent, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA, TASA_IVA } from "@/lib/financial/financialUtils";
import { parseMonto } from "@/lib/format/parseMonto";
import { totalLinea } from "@/features/cxp/utils/cuadreConceptos";
import type { ConceptoManual } from "@/features/cxp/hooks/useConceptosManuales";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

interface Props {
  concepto: ConceptoManual;
  moneda: string;
  resaltado?: boolean;
  onActualizar: <K extends keyof CfdiConceptoParsed>(
    key: string,
    campo: K,
    valor: CfdiConceptoParsed[K],
  ) => void;
  onEliminar: (key: string) => void;
  onDuplicar?: (key: string) => void;
  /** Enter en el último campo del renglón: agrega otra partida. */
  onAgregarSiguiente?: () => void;
}

function fmt2(n: number): string {
  return (Number(n) || 0).toFixed(2);
}

export function ConceptoLineaRow({
  concepto: c,
  moneda,
  resaltado = false,
  onActualizar,
  onEliminar,
  onDuplicar,
  onAgregarSiguiente,
}: Props) {
  const [cantidadTxt, setCantidadTxt] = useState(String(c.cantidad ?? 1));
  const [importeTxt, setImporteTxt] = useState(fmt2(c.importe ?? 0));
  const [ivaTxt, setIvaTxt] = useState(fmt2(c.iva ?? 0));

  const total = totalLinea({ monto: Number(c.importe) || 0, cantidad: c.cantidad });

  const aplicarIva16 = () => {
    // BUG-14: redondeo canónico (half away from zero, igual que Postgres);
    // el modelo CfdiConceptoParsed no guarda tasa por renglón, así que este
    // botón aplica la tasa general declarada en TASA_IVA.
    const iva = calcularIVA(total, TASA_IVA);
    setIvaTxt(fmt2(iva));
    onActualizar(c.key, "iva", iva);
  };

  return (
    <div
      className={
        resaltado
          ? "rounded-lg border border-warning/60 bg-warning/5 p-2"
          : "rounded-lg border border-border/70 bg-card p-2 hover:border-border"
      }
    >
      <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
        <Input
          className="h-9 w-full md:flex-1"
          placeholder="Descripción del servicio"
          value={c.descripcion}
          onChange={(e) => onActualizar(c.key, "descripcion", e.target.value)}
          aria-label="Descripción del concepto"
        />

        <label className="flex flex-1 items-center gap-1.5 md:flex-none">
          <span className="text-2xs text-muted-foreground md:hidden">Cant.</span>
          <Input
            className="h-9 w-full text-right tabular-nums md:w-16"
            inputMode="decimal"
            value={cantidadTxt}
            onChange={(e) => {
              setCantidadTxt(e.target.value);
              onActualizar(c.key, "cantidad", parseMonto(e.target.value, 1));
            }}
            onBlur={() => setCantidadTxt(String(parseMonto(cantidadTxt, 1) || 1))}
            aria-label="Cantidad"
          />
        </label>

        <label className="flex flex-1 items-center gap-1.5 md:flex-none">
          <span className="text-2xs text-muted-foreground md:hidden">Precio</span>
          <Input
            className="h-9 w-full text-right tabular-nums md:w-24"
            inputMode="decimal"
            value={importeTxt}
            onChange={(e) => {
              setImporteTxt(e.target.value);
              onActualizar(c.key, "importe", parseMonto(e.target.value));
            }}
            onBlur={() => setImporteTxt(fmt2(parseMonto(importeTxt)))}
            aria-label="Precio unitario"
          />
        </label>

        <label className="flex flex-1 items-center gap-1.5 md:flex-none">
          <span className="text-2xs text-muted-foreground md:hidden">IVA</span>
          <Input
            className="h-9 w-full text-right tabular-nums md:w-20"
            inputMode="decimal"
            value={ivaTxt}
            onChange={(e) => {
              setIvaTxt(e.target.value);
              onActualizar(c.key, "iva", parseMonto(e.target.value));
            }}
            onBlur={() => setIvaTxt(fmt2(parseMonto(ivaTxt)))}
            aria-label="IVA del concepto"
          />
        </label>

        <label className="flex flex-1 items-center gap-1.5 md:flex-none">
          <span className="text-2xs text-muted-foreground md:hidden">Unidad</span>
          <Input
            className="h-9 w-full md:w-16"
            placeholder="E48"
            value={c.clave_unidad ?? ""}
            onChange={(e) => onActualizar(c.key, "clave_unidad", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onAgregarSiguiente) {
                e.preventDefault();
                onAgregarSiguiente();
              }
            }}
            aria-label="Clave de unidad SAT"
          />
        </label>

        <span className="w-full text-right text-xs font-medium tabular-nums md:w-24">
          <span className="mr-1 text-2xs font-normal text-muted-foreground md:hidden">Total:</span>
          {formatCurrency(total, moneda)}
        </span>

        <div className="ml-auto flex w-auto items-center justify-end gap-0.5 md:w-16">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={aplicarIva16}
                aria-label="Aplicar IVA 16% a esta línea"
              >
                <Percent className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Calcular IVA 16%</TooltipContent>
          </Tooltip>
          {onDuplicar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => onDuplicar(c.key)}
                  aria-label="Duplicar concepto"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Duplicar línea</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onEliminar(c.key)}
                aria-label="Eliminar concepto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Eliminar línea</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
