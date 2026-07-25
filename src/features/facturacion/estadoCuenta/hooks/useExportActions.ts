/**
 * QW12 Tanda 3 — Lógica de exportación de Estado de Cuenta.
 * Extraída de ExportActions para bajar la complejidad ciclomática del componente.
 */
import { useState, useCallback } from "react";
import { generarEstadoCuentaPdf } from "@/generators/estadoCuentaPdf";
import { exportToCsv } from "@/generators/exportCsv";
import { formatDate } from "@/lib/formatters";
import { fetchClienteFichaEstadoCuenta } from "../services/clienteFicha";
import { notifyError } from "@/lib/ui/appFeedback";
import type { FacturaEstadoCuenta } from "../services/estadoCuenta";

const CSV_COLUMNS = [
  { key: "numero", label: "# Factura" },
  { key: "cliente_nombre", label: "Cliente" },
  { key: "expediente", label: "Expediente" },
  { key: "fecha_emision", label: "Emisión" },
  { key: "fecha_vencimiento", label: "Vencimiento" },
  { key: "estado", label: "Estado" },
  { key: "estatus_cobranza", label: "Cobranza" },
  { key: "moneda", label: "Moneda" },
  { key: "total", label: "Total" },
  { key: "saldo", label: "Saldo" },
  { key: "dias_vencido", label: "Días vencido" },
];

function buildCsvRows(rows: ReadonlyArray<FacturaEstadoCuenta>) {
  return rows.map((r) => ({
    numero: r.numero ?? "",
    cliente_nombre: r.cliente_nombre ?? "",
    expediente: r.expediente ?? "",
    fecha_emision: r.fecha_emision ? formatDate(r.fecha_emision) : "",
    fecha_vencimiento: r.fecha_vencimiento ? formatDate(r.fecha_vencimiento) : "",
    estado: r.estado_factura ?? "",
    estatus_cobranza: r.estatus_cobranza ?? "",
    moneda: r.moneda ?? "",
    total: r.total ?? 0,
    saldo: r.saldo ?? 0,
    dias_vencido: r.dias_vencido ?? 0,
  }));
}

export function useExportActions(clienteIds: string[], rows: ReadonlyArray<FacturaEstadoCuenta>) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const soloUnCliente = clienteIds.length === 1;

  const onPdf = useCallback(async () => {
    if (!soloUnCliente) return;
    setBusy("pdf");
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre, rfc, direccion, ciudad, estado")
        .eq("id", clienteIds[0])
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Cliente no encontrado");
      await generarEstadoCuentaPdf(data);
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo generar el PDF",
        error: err as Error,
        method: "ESTADO_CUENTA_EXPORT_PDF",
      });
    } finally {
      setBusy(null);
    }
  }, [clienteIds, soloUnCliente]);

  const onCsv = useCallback(() => {
    setBusy("csv");
    try {
      exportToCsv(
        `estado-de-cuenta-${new Date().toISOString().slice(0, 10)}.csv`,
        CSV_COLUMNS,
        buildCsvRows(rows),
      );
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo generar el CSV",
        error: err as Error,
        method: "ESTADO_CUENTA_EXPORT_CSV",
      });
    } finally {
      setBusy(null);
    }
  }, [rows]);

  return { busy, onPdf, onCsv, soloUnCliente };
}
