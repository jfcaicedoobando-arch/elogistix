import { useState, useMemo } from "react";
import { Download, FileCheck2, FileText, FileCode2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { exportToCsv } from "@/generators/exportCsv";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useProformas, type ProformaRow, type ProformaConFactura } from "@/hooks/embarque/useProformas";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { generarPdfProforma } from "@/generators/proformaPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DialogMarcarFacturada } from "./DialogMarcarFacturada";

const DEFAULT_PAGE_SIZE = 20;
type FiltroEstado = "todas" | "pendiente" | "facturada";

export function TabProformas() {
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todas");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [proformaAFacturar, setProformaAFacturar] = useState<ProformaRow | null>(null);

  const { data: proformas = [], isLoading } = useProformas();
  const tasaIva = useTasaIVA();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proformas.filter(p => {
      if (filtroEstado !== "todas" && (p.estado_proforma ?? "pendiente") !== filtroEstado) return false;
      if (!q) return true;
      return (
        p.numero.toLowerCase().includes(q) ||
        p.expediente.toLowerCase().includes(q) ||
        p.cliente_nombre.toLowerCase().includes(q) ||
        (p.folio_factura_externa ?? "").toLowerCase().includes(q)
      );
    });
  }, [proformas, search, filtroEstado]);

  const counts = useMemo(() => ({
    todas: proformas.length,
    pendiente: proformas.filter(p => (p.estado_proforma ?? "pendiente") === "pendiente").length,
    facturada: proformas.filter(p => p.estado_proforma === "facturada").length,
  }), [proformas]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleDescargar = async (proforma: ProformaRow) => {
    setDownloadingId(proforma.id);
    try {
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
      key: "estado", header: "Estado", width: "w-[110px]",
      sortable: true, sortValue: (p) => p.estado_proforma ?? "pendiente",
      render: (p) => {
        const estado = p.estado_proforma ?? "pendiente";
        return estado === "facturada" ? (
          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Facturada</Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Pendiente</Badge>
        );
      },
    },
    {
      key: "folio_factura", header: "Folio Factura", width: "w-[180px]", className: "text-xs",
      sortable: true, sortValue: (p) => p.folio_factura_externa ?? '',
      render: (p) => {
        if (!p.folio_factura_externa) return <span className="text-muted-foreground">—</span>;
        const pdfUrl = p.facturas?.factura_pdf_url;
        const xmlUrl = p.facturas?.factura_xml_url;
        return (
          <div className="flex items-center gap-1">
            <span className="font-mono">{p.folio_factura_externa}</span>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download
                title="Descargar PDF" onClick={(e) => e.stopPropagation()}>
                <FileText className="h-3.5 w-3.5 text-red-600 hover:text-red-700" />
              </a>
            )}
            {xmlUrl && (
              <a href={xmlUrl} target="_blank" rel="noopener noreferrer" download
                title="Descargar XML" onClick={(e) => e.stopPropagation()}>
                <FileCode2 className="h-3.5 w-3.5 text-blue-600 hover:text-blue-700" />
              </a>
            )}
          </div>
        );
      },
    },
    {
      key: "acciones", header: "Acciones", width: "w-[200px]",
      render: (p) => {
        const facturada = (p.estado_proforma ?? "pendiente") === "facturada";
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={downloadingId === p.id}
              onClick={(e) => { e.stopPropagation(); handleDescargar(p); }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
            {!facturada && (
              <Button
                variant="default"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setProformaAFacturar(p); }}
              >
                <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Facturada
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder="Buscar por número, expediente, cliente o folio..."
            className="flex-1 min-w-[240px]"
          />
          <Tabs value={filtroEstado} onValueChange={(v) => { setFiltroEstado(v as FiltroEstado); setPage(0); }}>
            <TabsList>
              <TabsTrigger value="todas">Todas ({counts.todas})</TabsTrigger>
              <TabsTrigger value="pendiente">Pendientes ({counts.pendiente})</TabsTrigger>
              <TabsTrigger value="facturada">Facturadas ({counts.facturada})</TabsTrigger>
            </TabsList>
          </Tabs>
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
                { key: "estado", label: "Estado" },
                { key: "folio_factura", label: "Folio Factura" },
                { key: "fecha_facturacion", label: "Fecha Facturación" },
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
                estado: p.estado_proforma ?? 'pendiente',
                folio_factura: p.folio_factura_externa ?? '',
                fecha_facturacion: p.fecha_facturacion ?? '',
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

      <DialogMarcarFacturada
        open={!!proformaAFacturar}
        onOpenChange={(o) => !o && setProformaAFacturar(null)}
        proforma={proformaAFacturar}
      />
    </div>
  );
}
