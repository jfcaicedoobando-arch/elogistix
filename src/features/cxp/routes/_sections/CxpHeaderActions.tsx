/**
 * Acciones del encabezado de Facturas de proveedor. Extraídas de `Cxp.tsx`
 * en v13.823.312 (Power-of-10: ≤200 líneas). Sin cambios visuales.
 */
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

export function CxpHeaderActions({
  puedeCapturar,
  puedeExportar,
  onExportar,
  onCapturar,
}: {
  puedeCapturar: boolean;
  puedeExportar: boolean;
  onExportar: () => void;
  onCapturar: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onExportar} disabled={!puedeExportar}>
        <Download className="h-4 w-4 mr-2" /> Exportar CSV
      </Button>
      <Button variant="outline" onClick={() => navigate(ROUTES.REPORTES_CARTERA)}>
        <FileText className="h-4 w-4 mr-2" /> Cartera y antigüedad
      </Button>
      {puedeCapturar && (
        <Button onClick={onCapturar}>
          <Plus className="h-4 w-4 mr-2" /> Capturar factura
        </Button>
      )}
    </div>
  );
}
