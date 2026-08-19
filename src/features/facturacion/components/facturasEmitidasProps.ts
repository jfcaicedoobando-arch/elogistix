/**
 * Contratos de props agrupadas para la bandeja "Facturas emitidas"
 * (auditoría 2026-08-18, punto 7: prop drilling severo).
 *
 * En lugar de pasar 26 props sueltas a través de 3 niveles, la pantalla
 * arma 3 objetos con responsabilidad clara: filtros, tabla y acciones.
 */
import type { ColumnDef } from "@/components/shared/DataTable";
import type { Factura } from "@/features/facturacion/routes/facturacionColumns";

export interface ClienteOption {
  id: string;
  nombre: string;
}

/** Estado de búsqueda/filtrado de la bandeja. */
export interface FacturasEmitidasFiltros {
  search: string;
  setSearch: (v: string) => void;
  filterEstado: string;
  filterCliente: string;
  setFilter: <K extends "estado" | "cliente">(k: K, v: string) => void;
  fechaDesde: string;
  setFechaDesde: (v: string) => void;
  fechaHasta: string;
  setFechaHasta: (v: string) => void;
  clientes: ClienteOption[];
  onClear: () => void;
}

/** Datos, estado de carga y paginación de la tabla. */
export interface FacturasEmitidasTabla {
  columns: ColumnDef<Factura, unknown>[];
  data: Factura[];
  facturasFiltradas: Factura[];
  totalFacturas: number;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  page: number;
  totalPages: number;
  setPage: (n: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
}

/** Acciones que dispara el usuario desde la bandeja. */
export interface FacturasEmitidasAcciones {
  exportarFacturasCsv: () => void;
  exportarLayoutContable: () => void;
  onCreateNew?: () => void;
}
