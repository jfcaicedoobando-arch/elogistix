/**
 * Botonera de un documento del buzón de facturas de proveedor.
 * Separada de `FacturaEntranteItem` para mantener cada función simple.
 */
import { useRef } from "react";
import { FileCode2, FileText, PencilLine, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FacturaEntranteRow } from "@/features/cxp/services";

function AdjuntarXmlButton({ onSelect }: { onSelect: (xml: File) => void }) {
  const inputXml = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => inputXml.current?.click()}>
        <Upload className="mr-2 h-4 w-4" /> Adjuntar XML
      </Button>
      <input
        ref={inputXml}
        type="file"
        className="hidden"
        accept=".xml,text/xml,application/xml"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) onSelect(archivo);
          e.target.value = "";
        }}
      />
    </>
  );
}

interface AccionesProps {
  row: FacturaEntranteRow;
  tienePdf: boolean;
  tieneXml: boolean;
  puedeEliminar: boolean;
  puedeAdjuntarXml: boolean;
  puedeReactivar: boolean;
  puedeCorregir: boolean;
  onVer: (path: string, nombre: string) => void;
  onAdjuntarXml: (row: FacturaEntranteRow, xml: File) => void;
  onEliminar: (row: FacturaEntranteRow) => void;
  onReactivar?: (row: FacturaEntranteRow) => void;
  onCorregir?: (row: FacturaEntranteRow) => void;
}

export function AccionesEntrante({
  row, tienePdf, tieneXml, puedeEliminar, puedeAdjuntarXml, puedeReactivar, puedeCorregir,
  onVer, onAdjuntarXml, onEliminar, onReactivar, onCorregir,
}: AccionesProps) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {tienePdf && (
        <Button size="sm" variant="outline" onClick={() => onVer(row.archivo_path, row.nombre_archivo)}>
          <FileText className="mr-2 h-4 w-4" /> Ver PDF
        </Button>
      )}
      {tieneXml && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onVer(row.xml_path ?? row.archivo_path, row.xml_nombre ?? row.nombre_archivo)}
        >
          <FileCode2 className="mr-2 h-4 w-4" /> XML
        </Button>
      )}
      {!tieneXml && puedeAdjuntarXml && (
        <AdjuntarXmlButton onSelect={(xml) => onAdjuntarXml(row, xml)} />
      )}
      {puedeCorregir && onCorregir && (
        <Button size="sm" variant="outline" onClick={() => onCorregir(row)}>
          <PencilLine className="mr-2 h-4 w-4" /> Corregir datos
        </Button>
      )}
      {puedeReactivar && onReactivar && (
        <Button size="sm" variant="secondary" onClick={() => onReactivar(row)}>
          <RotateCcw className="mr-2 h-4 w-4" /> Devolver a por capturar
        </Button>
      )}
      {puedeEliminar && (
        <Button size="sm" variant="ghost" onClick={() => onEliminar(row)} aria-label="Retirar del buzón">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
