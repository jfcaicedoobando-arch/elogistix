/**
 * Un renglón de la captura manual de conceptos de factura de proveedor
 * (v13.629.0). Maneja el texto local de los campos numéricos para poder
 * formatear al salir del campo (12 → 12.00) sin pelearse con el estado padre.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA, TASA_IVA } from "@/lib/financial/financialUtils";
import { parseImporteFiscal } from "@/lib/domain/facturaConceptos";
import { normalizarCantidadCaptura } from "../utils/conceptosPersistibles";
import { parseMonto } from "@/lib/format/parseMonto";
import { totalLinea } from "@/features/cxp/utils/cuadreConceptos";
import type { ConceptoManual } from "@/features/cxp/hooks/useConceptosManuales";
import type { CfdiConceptoParsed } from "@/features/cxp/services";
import { ConceptoLineaAcciones } from "./ConceptoLineaAcciones";

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
  return parseImporteFiscal(n).toFixed(2);
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
  const [iepsTxt, setIepsTxt] = useState(fmt2(c.ieps ?? 0));

  const cantidadValida = normalizarCantidadCaptura(c.cantidad) > 0;
  const total = cantidadValida ? totalLinea({ monto: Number(c.importe) || 0, cantidad: c.cantidad }) : 0;

  const aplicarIva16 = () => {
    // BUG-14: redondeo canónico (half away from zero, igual que Postgres);
    // el modelo CfdiConceptoParsed no guarda tasa por renglón, así que este
    // botón aplica la tasa general declarada en TASA_IVA.
    const iva = calcularIVA(total + (Number(c.ieps) || 0), TASA_IVA);
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
          className="h-9 w-full min-w-0 md:flex-1"
          placeholder="Descripción del servicio"
          value={c.descripcion}
          onChange={(e) => onActualizar(c.key, "descripcion", e.target.value)}
          aria-label="Descripción del concepto"
        />

        <label className="flex min-w-[10rem] flex-1 items-center gap-1.5 md:min-w-0 md:flex-none">
          <span className="text-label text-muted-foreground md:hidden">Cant.</span>
          <Input
            className="h-9 w-full text-right tabular-nums md:w-16"
            inputMode="decimal"
            value={cantidadTxt}
            onChange={(e) => {
              setCantidadTxt(e.target.value);
              // FIX-R3: la cantidad NO es dinero — sin el opt-out, "1.500"
              // (una cantidad con 3 decimales) se leería como 1,500.
              onActualizar(c.key, "cantidad", normalizarCantidadCaptura(parseMonto(e.target.value, 1, { puntoDeMiles: false })));
            }}
            onBlur={() => {
              const cantidad = normalizarCantidadCaptura(parseMonto(cantidadTxt, 1, { puntoDeMiles: false }));
              setCantidadTxt(String(cantidad));
              onActualizar(c.key, "cantidad", cantidad);
            }}
            aria-label="Cantidad"
            aria-invalid={!cantidadValida}
          />
        </label>

        <label className="flex min-w-[10rem] flex-1 items-center gap-1.5 md:min-w-0 md:flex-none">
          <span className="text-label text-muted-foreground md:hidden">Precio</span>
          <Input
            className="h-9 w-full text-right tabular-nums md:w-24"
            inputMode="decimal"
            value={importeTxt}
            onChange={(e) => {
              setImporteTxt(e.target.value);
              onActualizar(c.key, "importe", parseImporteFiscal(parseMonto(e.target.value)));
            }}
            onBlur={() => {
              const valor = parseImporteFiscal(parseMonto(importeTxt));
              setImporteTxt(fmt2(valor));
              onActualizar(c.key, "importe", valor);
            }}
            aria-label="Precio unitario"
          />
        </label>

        <label className="flex min-w-[10rem] flex-1 items-center gap-1.5 md:min-w-0 md:flex-none">
          <span className="text-label text-muted-foreground md:hidden">IVA</span>
          <Input
            className="h-9 w-full text-right tabular-nums md:w-20"
            inputMode="decimal"
            value={ivaTxt}
            onChange={(e) => {
              setIvaTxt(e.target.value);
              onActualizar(c.key, "iva", parseImporteFiscal(parseMonto(e.target.value)));
            }}
            onBlur={() => {
              const valor = parseImporteFiscal(parseMonto(ivaTxt));
              setIvaTxt(fmt2(valor));
              onActualizar(c.key, "iva", valor);
            }}
            aria-label="IVA del concepto"
          />
        </label>

        <label className="flex min-w-[10rem] flex-1 items-center gap-1.5 md:min-w-0 md:flex-none">
          <span className="text-label text-muted-foreground md:hidden">IEPS</span>
          <Input
            className="h-9 w-full text-right tabular-nums md:w-20"
            inputMode="decimal"
            value={iepsTxt}
            onChange={(e) => {
              setIepsTxt(e.target.value);
              onActualizar(c.key, "ieps", parseImporteFiscal(parseMonto(e.target.value)));
            }}
            onBlur={() => {
              const valor = parseImporteFiscal(parseMonto(iepsTxt));
              setIepsTxt(fmt2(valor));
              onActualizar(c.key, "ieps", valor);
            }}
            aria-label="IEPS del concepto"
          />
        </label>

        <label className="flex min-w-[10rem] flex-1 items-center gap-1.5 md:min-w-0 md:flex-none">
          <span className="text-label text-muted-foreground md:hidden">Unidad</span>
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

        <span className="w-full text-right text-body-sm font-medium tabular-nums md:w-24">
          <span className="mr-1 text-label font-normal text-muted-foreground md:hidden">Total:</span>
          {formatCurrency(total, moneda)}
        </span>

        <ConceptoLineaAcciones
          onAplicarIva={aplicarIva16}
          onDuplicar={onDuplicar ? () => onDuplicar(c.key) : undefined}
          onEliminar={() => onEliminar(c.key)}
        />
      </div>
      {!cantidadValida && <p role="alert" className="text-body-sm text-destructive">La cantidad debe ser al menos 0.000001.</p>}
    </div>
  );
}
