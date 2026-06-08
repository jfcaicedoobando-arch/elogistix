/**
 * Efectos de hidratación para EditarEmbarque. Extraído de useEditarEmbarqueWizard
 * para mantener el controller bajo el límite Power of 10 (<200 líneas).
 */
import { useEffect } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import { rowAContenedorBorrador } from "@/features/embarques/types/contenedor";
import { resolverValorContactoDesdeTexto } from "@/lib/contacto";

interface ConceptoVentaDb {
  descripcion: string;
  cantidad: number;
  precio_unitario: number | string;
  moneda: string;
  contenedor_id: string | null;
}
interface ConceptoCostoDb {
  proveedor_id: string | null;
  concepto: string;
  monto: number | string;
  moneda: string;
  contenedor_id: string | null;
}

interface Params<TForm extends FieldValues> {
  initialized: boolean;
  hidratoContactos: boolean;
  hidratoContenedores: boolean;
  setHidratoContactos: (v: boolean) => void;
  setHidratoContenedores: (v: boolean) => void;
  embarque: { shipper: string | null; consignatario: string | null } | undefined | null;
  contactos: Parameters<typeof resolverValorContactoDesdeTexto>[1];
  selectedClienteNombre?: string;
  contenedoresDb: Parameters<typeof rowAContenedorBorrador>[0][];
  cargandoContenedores: boolean;
  conceptosVentaDb: ConceptoVentaDb[];
  conceptosCostoDb: ConceptoCostoDb[];
  inicializarVenta: (rows: Array<{ id: number; concepto: string; cantidad: number; precioUnitario: number; moneda: string; contenedorId: string | null }>) => void;
  inicializarCosto: (rows: Array<{ id: number; proveedorId: string; concepto: string; monto: number; moneda: string; contenedorId: string | null }>) => void;
  methods: UseFormReturn<TForm>;
}

export function useHidratacionEditarEmbarque<TForm extends FieldValues>(p: Params<TForm>) {
  // Conceptos venta
  useEffect(() => {
    if (!p.initialized || p.conceptosVentaDb.length === 0) return;
    p.inicializarVenta(p.conceptosVentaDb.map((v, i) => ({
      id: i + 1,
      concepto: v.descripcion,
      cantidad: v.cantidad,
      precioUnitario: Number(v.precio_unitario),
      moneda: v.moneda,
      contenedorId: v.contenedor_id ?? null,
    })));
  }, [p.conceptosVentaDb, p.initialized, p.inicializarVenta, p]);

  // Conceptos costo
  useEffect(() => {
    if (!p.initialized || p.conceptosCostoDb.length === 0) return;
    p.inicializarCosto(p.conceptosCostoDb.map((c, i) => ({
      id: i + 1,
      proveedorId: c.proveedor_id ?? "",
      concepto: c.concepto,
      monto: Number(c.monto),
      moneda: c.moneda,
      contenedorId: c.contenedor_id ?? null,
    })));
  }, [p.conceptosCostoDb, p.initialized, p.inicializarCosto, p]);

  // Contactos shipper/consignatario
  useEffect(() => {
    if (!p.initialized || p.hidratoContactos || !p.embarque) return;
    const shipperResuelto = resolverValorContactoDesdeTexto(
      p.embarque.shipper, p.contactos, p.selectedClienteNombre,
    );
    const consigResuelto = resolverValorContactoDesdeTexto(
      p.embarque.consignatario, p.contactos, p.selectedClienteNombre, { permitirCliente: true },
    );
    p.methods.setValue("shipper", shipperResuelto.value, { shouldDirty: false });
    p.methods.setValue("shipperManual", shipperResuelto.manual, { shouldDirty: false });
    p.methods.setValue("consignatario", consigResuelto.value, { shouldDirty: false });
    p.methods.setValue("consignatarioManual", consigResuelto.manual, { shouldDirty: false });
    p.setHidratoContactos(true);
  }, [p]);

  // Contenedores
  useEffect(() => {
    if (!p.initialized || p.hidratoContenedores || p.cargandoContenedores) return;
    p.methods.setValue(
      "contenedores",
      p.contenedoresDb.map(rowAContenedorBorrador),
      { shouldDirty: false },
    );
    p.setHidratoContenedores(true);
  }, [p]);
}
