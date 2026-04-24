import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { exportToCsv } from "@/generators/exportCsv";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useProformas, type ProformaRow } from "@/hooks/embarque/useProformas";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { generarPdfProforma } from "@/generators/proformaPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_PAGE_SIZE = 20;

export function TabProformas() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: proformas = [], isLoading } = useProformas();
  const tasaIva = useTasaIVA();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return proformas;
    return proformas.filter(p =>
      p.numero.toLowerCase().includes(q) ||
      p.expediente.toLowerCase().includes(q) ||
      p.cliente_nombre.toLowerCase().includes(q)
    );
  }, [proformas, search]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleDescargar = async (proforma: ProformaRow) => {
    setDownloadingId(proforma.id);
    try {
      // Cargar embarque, conceptos y cliente en paralelo
      const [embarqueRes, conceptosRes, clienteRes] = await Promise.all([
        supabase
          .from('embarques')
          .select('expediente, bl_master, modo, tipo, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, naviera, aerolinea, descripcion_mercancia')
          .eq('id', proforma.embarque_id)
          .single(),
        supabase
          .from('conceptos_venta')
          .select('*')
          .eq('proforma_id', proforma.id),
        supabase
          .from('clientes')
          .select('nombre, rfc, direccion, ciudad, estado, cp')
          .eq('id', proforma.cliente_id)
          .maybeSingle(),
      ]);

      if (embarqueRes.error) throw embarqueRes.error;
      if (conceptosRes.error) throw conceptosRes.error;

      generarPdfProforma({
        proforma,
        embarque: embarqueRes.data,
        conceptos: conceptosRes.data || [],
        cliente: clienteRes.data,
        tasaIva,
      });
    } catch (e) {
      toast.error('Error al generar PDF: ' + (e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const columns: DataTableColumn<ProformaRow>[] = [
    {
      key: "numero", header: "# Proforma", width: "w-[140px]", className: "font-medium",
      sticky: true, sortable: true, sortValue: (p) => p.numero, render: (p) => p.numero,
    },
    {
      key: "expediente", header: "Expediente", width: "w-[120px]",
      sortable: true, sortValue: (p) => p.expediente, render: (p) => p.expediente,
    },
    {
      key: "cliente", header: "Cliente", width: "min-w-[180px]", className: "max-w-[220px] truncate",
      sortable: true, sortValue: (p) => p.cliente_nombre, render: (p) => p.cliente_nombre,
    },
    {
      key: "operador", header: "Operador", width: "w-[140px]", className: "text-xs",
      sortable: true, sortValue: (p) => p.operador || '',
      render: (p) => p.operador || <span className="text-muted-foreground">—</span>,
    },
    {
      key: "dias_credito", header: "Días Crédito", width: "w-[110px]", className: "text-right text-xs",
      sortable: true, sortValue: (p) => p.dias_credito ?? -1,
      render: (p) => p.dias_credito == null ? '—' : Number(p.dias_credito) === 0 ? 'Contado' : `${p.dias_credito} días`,
    },
    {
      key: "monto_usd", header: "Monto USD", width: "w-[120px]", className: "text-right",
      sortable: true, sortValue: (p) => Number(p.total_usd),
      render: (p) => Number(p.total_usd) > 0 ? formatCurrency(Number(p.total_usd), 'USD') : '—',
    },
    {
      key: "monto_mxn", header: "Monto MXN", width: "w-[120px]", className: "text-right",
      sortable: true, sortValue: (p) => Number(p.total_mxn),
      render: (p) => Number(p.total_mxn) > 0 ? formatCurrency(Number(p.total_mxn), 'MXN') : '—',
    },
    {
      key: "fecha", header: "Fecha", width: "w-[100px]", className: "text-xs",
      sortable: true, sortValue: (p) => p.fecha_emision, render: (p) => formatDate(p.fecha_emision),
    },
    {
      key: "acciones", header: "Acciones", width: "w-[120px]",
      render: (p) => (
        <Button
          variant="outline"
          size="sm"
          disabled={downloadingId === p.id}
          onClick={(e) => { e.stopPropagation(); handleDescargar(p); }}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Descargar
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder="Buscar por número, expediente o cliente..."
            className="flex-1 min-w-[240px]"
          />
          <Button
            variant="outline"
            disabled={filtered.length === 0}
            onClick={() => exportToCsv(
              `proformas_${new Date().toISOString().slice(0, 10)}.csv`,
              [
                { key: "numero", label: "# Proforma" },
                { key: "expediente", label: "Expediente" },
                { key: "cliente", label: "Cliente" },
                { key: "operador", label: "Operador" },
                { key: "dias_credito", label: "Días Crédito" },
                { key: "subtotal_usd", label: "Subtotal USD" },
                { key: "iva_usd", label: "IVA USD" },
                { key: "total_usd", label: "Total USD" },
                { key: "subtotal_mxn", label: "Subtotal MXN" },
                { key: "iva_mxn", label: "IVA MXN" },
                { key: "total_mxn", label: "Total MXN" },
                { key: "fecha", label: "Fecha" },
              ],
              filtered.map(p => ({
                numero: p.numero,
                expediente: p.expediente,
                cliente: p.cliente_nombre,
                operador: p.operador ?? '',
                dias_credito: p.dias_credito ?? '',
                subtotal_usd: Number(p.subtotal_usd),
                iva_usd: Number(p.iva_usd),
                total_usd: Number(p.total_usd),
                subtotal_mxn: Number(p.subtotal_mxn),
                iva_mxn: Number(p.iva_mxn),
                total_mxn: Number(p.total_mxn),
                fecha: p.fecha_emision,
              })),
            )}
          >
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paginated}
            isLoading={isLoading}
            emptyMessage="No hay proformas generadas"
            rowKey={(p) => p.id}
          />
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
