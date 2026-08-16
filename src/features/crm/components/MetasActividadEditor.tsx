/**
 * Editor de metas de actividad por periodo (Etapa 3 CRM Hunter).
 * Equivalente a la hoja "01_Parametros" del Excel comercial.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  useMetasActividad, useGuardarMetaActividad,
} from "@/features/crm/hooks/useHigienePipeline";
import { PERIODOS_META, type PeriodoMeta } from "@/features/crm/services/metasPresupuesto";

type CampoMeta = "icp_validados" | "contactadas" | "reuniones" | "cotizaciones";

const CAMPOS: { key: CampoMeta; label: string }[] = [
  { key: "icp_validados", label: "ICP validados" },
  { key: "contactadas", label: "Empresas contactadas" },
  { key: "reuniones", label: "Reuniones" },
  { key: "cotizaciones", label: "Cotizaciones" },
];

type Borrador = Partial<Record<PeriodoMeta, Partial<Record<CampoMeta, string>>>>;

export default function MetasActividadEditor() {
  const { organizationId } = useOrganization();
  const { data = [] } = useMetasActividad();
  const guardar = useGuardarMetaActividad();
  const [borrador, setBorrador] = useState<Borrador>({});

  const valorDe = (periodo: PeriodoMeta, campo: CampoMeta): string => {
    const draft = borrador[periodo]?.[campo];
    if (draft !== undefined) return draft;
    const fila = data.find((f) => f.periodo === periodo);
    return fila ? String(fila[campo]) : "0";
  };

  const setValor = (periodo: PeriodoMeta, campo: CampoMeta, valor: string) =>
    setBorrador((b) => ({ ...b, [periodo]: { ...b[periodo], [campo]: valor } }));

  const handleGuardar = async (periodo: PeriodoMeta) => {
    if (!organizationId) return;
    await guardar.mutateAsync({
      organizationId,
      periodo,
      icp_validados: Number(valorDe(periodo, "icp_validados")) || 0,
      contactadas: Number(valorDe(periodo, "contactadas")) || 0,
      reuniones: Number(valorDe(periodo, "reuniones")) || 0,
      cotizaciones: Number(valorDe(periodo, "cotizaciones")) || 0,
    });
    setBorrador((b) => {
      const next = { ...b };
      delete next[periodo];
      return next;
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Periodo</TableHead>
          {CAMPOS.map((c) => (
            <TableHead key={c.key} className="text-right">{c.label}</TableHead>
          ))}
          <TableHead className="w-28" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {PERIODOS_META.map(({ value, label }) => (
          <TableRow key={value}>
            <TableCell>{label}</TableCell>
            {CAMPOS.map((campo) => (
              <TableCell key={campo.key} className="text-right">
                <Input
                  type="number"
                  min={0}
                  className="text-right"
                  value={valorDe(value, campo.key)}
                  onChange={(e) => setValor(value, campo.key, e.target.value)}
                />
              </TableCell>
            ))}
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                disabled={borrador[value] === undefined}
                onClick={() => handleGuardar(value)}
              >
                Guardar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
