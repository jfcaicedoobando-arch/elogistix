import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DialogDescargarZipMes } from "./DialogDescargarZipMes";
import type { FacturasEmitidasAcciones } from "./facturasEmitidasProps";

/** Exportación del resultado filtrado y acceso al paquete mensual independiente. */
export function FacturasExportMenu({ acciones }: { acciones: FacturasEmitidasAcciones }) {
  const [zipMesOpen, setZipMesOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="shrink-0 gap-2" disabled={acciones.exportando}>
            <Download className="h-4 w-4" />
            <span>{acciones.exportando ? "Exportando…" : "Exportar"}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem disabled={acciones.exportDisabled} onClick={acciones.exportarFacturasCsv}>
            CSV de facturas
          </DropdownMenuItem>
          <DropdownMenuItem disabled={acciones.exportDisabled} onClick={acciones.exportarLayoutContable} title="Todas las facturas filtradas con RFC, subtotal, IVA y total">
            Layout contable
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setZipMesOpen(true)} title="Paquete PDF+XML de todos los CFDI del mes, generado por el PAC">
            ZIP del mes (PAC)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogDescargarZipMes open={zipMesOpen} onOpenChange={setZipMesOpen} />
    </>
  );
}
