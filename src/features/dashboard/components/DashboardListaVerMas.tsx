/**
 * V-11 (auditoría visual 2026-08-21) — Las tarjetas del dashboard ya no usan
 * scroll propio (`max-h` + `overflow-y-auto`): en tableta aparecían dos barras
 * de desplazamiento simultáneas. En su lugar muestran los primeros
 * `MAX_ITEMS_TARJETA_DASHBOARD` elementos y ofrecen un enlace al módulo
 * completo para el resto.
 */
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const MAX_ITEMS_TARJETA_DASHBOARD = 5;

interface Props {
  /** Total de elementos disponibles (no los visibles). */
  total: number;
  /** Ruta del módulo con la lista completa. */
  ruta: string;
  /** Texto del enlace, p. ej. "embarques". */
  etiqueta: string;
}

export function DashboardListaVerMas({ total, ruta, etiqueta }: Props) {
  const navigate = useNavigate();
  const restantes = total - MAX_ITEMS_TARJETA_DASHBOARD;
  if (restantes <= 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-center text-body-sm"
      onClick={() => navigate(ruta)}
    >
      Ver {restantes} más en {etiqueta}
      <ArrowRight className="ml-1 h-4 w-4" />
    </Button>
  );
}
