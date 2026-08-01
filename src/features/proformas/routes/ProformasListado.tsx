/**
 * Página dedicada `/proformas`: listado completo de proformas con búsqueda,
 * filtros (Todas / Pendientes / Facturadas), paginación, export CSV y acción
 * "Marcar facturada". Reutiliza el componente <TabProformas/> que ya vive
 * dentro del módulo de Facturación para no duplicar lógica.
 *
 * v13.387.1 — Soporta `?estado=` para las bandejas del sidebar
 * (ej. "Por emitir" → /proformas?estado=aceptada).
 */
import { FileSpreadsheet } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabProformas } from "@/features/facturacion/components/TabProformas";
import type { FiltroEstadoProforma } from "@/features/facturacion/hooks";

const ESTADOS_VALIDOS: FiltroEstadoProforma[] = [
  "todas",
  "pendiente",
  "aceptada",
  "rechazada",
  "facturada",
];

function parseEstado(valor: string | null): FiltroEstadoProforma {
  return ESTADOS_VALIDOS.find((e) => e === valor) ?? "todas";
}

export default function ProformasListado() {
  const [searchParams] = useSearchParams();
  const estadoInicial = parseEstado(searchParams.get("estado"));
  const porEmitir = estadoInicial === "aceptada";

  return (
    <PageContainer>
      <PageHeader
        icon={<FileSpreadsheet className="h-6 w-6 text-primary" />}
        title={porEmitir ? "Proformas por emitir" : "Proformas"}
        description={
          porEmitir
            ? "Proformas aceptadas por el cliente que aún no se han convertido en factura."
            : "Listado completo de proformas generadas. Filtra por estado, busca por número/expediente/cliente y marca como facturadas."
        }
      />
      <TabProformas key={estadoInicial} estadoInicial={estadoInicial} />
    </PageContainer>
  );
}
