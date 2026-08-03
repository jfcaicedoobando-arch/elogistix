/**
 * Acciones de una fila del buzón CxP (extraído para complejidad ≤16).
 * v13.368.0
 */
import { Link } from "react-router-dom";
import { CheckCircle2, Eye, FileCode2, FilePlus2, MoreHorizontal, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FacturaEntranteRow as Fila } from "@/features/cxp/services/facturasEntrantes";

interface Props {
  row: Fila;
  editable: boolean;
  /** Id de la factura viva que ya usa este CFDI, si existe. */
  facturaExistenteId: string | null;
  onVer: (row: Fila) => void;
  onVerXml: (row: Fila) => void;
  onCapturar: (row: Fila) => void;
  onCrearFactura: (row: Fila) => void;
  onRechazar: (row: Fila) => void;
}

export function FacturaEntranteAcciones({
  row,
  editable,
  facturaExistenteId,
  onVer,
  onVerXml,
  onCapturar,
  onCrearFactura,
  onRechazar,
}: Props) {
  const yaCapturado = facturaExistenteId !== null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {editable && yaCapturado && (
        <Button size="sm" variant="outline" asChild>
          <Link to={`/compras/facturas/${facturaExistenteId}`}>
            <Eye className="mr-2 h-4 w-4" /> Ver factura
          </Link>
        </Button>
      )}
      {editable && !yaCapturado && (
        <Button size="sm" onClick={() => onCrearFactura(row)}>
          <FilePlus2 className="mr-2 h-4 w-4" /> Capturar factura
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Más acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* v13.398.0 — "Ver" sale de la fila (el clic en la fila ya abre la previa). */}
          <DropdownMenuItem onClick={() => onVer(row)}>
            <Eye className="mr-2 h-4 w-4" /> Ver documento
          </DropdownMenuItem>

          {row.xml_path && (
            <DropdownMenuItem onClick={() => onVerXml(row)}>
              <FileCode2 className="mr-2 h-4 w-4" /> Descargar XML
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to={`/embarques/${row.embarque_id}?tab=costos&focus=facturas-entrantes`}>
              Ir al embarque
            </Link>
          </DropdownMenuItem>
          {editable && (
            <DropdownMenuItem onClick={() => onCapturar(row)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Vincular a factura existente
            </DropdownMenuItem>
          )}
          {editable && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onRechazar(row)}
            >
              <XCircle className="mr-2 h-4 w-4" /> Rechazar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
