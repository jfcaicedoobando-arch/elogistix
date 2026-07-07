/**
 * Efectos de hidratación para EditarEmbarque. Extraído de useEditarEmbarqueWizard
 * para mantener el controller bajo el límite Power of 10 (<200 líneas).
 */
import { useEffect } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import { rowAContenedorBorrador } from "@/features/embarques/types/contenedor";
import { resolverValorContactoDesdeTexto } from "@/features/cliente/domain/contacto";

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
  hidratoVenta: boolean;
  hidratoCosto: boolean;
  setHidratoContactos: (v: boolean) => void;
  setHidratoContenedores: (v: boolean) => void;
  setHidratoVenta: (v: boolean) => void;
  setHidratoCosto: (v: boolean) => void;
  embarque: { shipper: string | null; consignatario: string | null } | undefined | null;
  contactos: Parameters<typeof resolverValorContactoDesdeTexto>[1];
  selectedClienteNombre?: string;
  contenedoresDb: Parameters<typeof rowAContenedorBorrador>[0][];
  cargandoContenedores: boolean;
  conceptosVentaDb: ConceptoVentaDb[];
  conceptosCostoDb: ConceptoCostoDb[];
  inicializarVenta: (rows: Array<{ id: number; dbId?: string | null; concepto: string; cantidad: number; precioUnitario: number; moneda: string; contenedorId: string | null }>) => void;
  inicializarCosto: (rows: Array<{ id: number; dbId?: string | null; proveedorId: string; concepto: string; monto: number; moneda: string; contenedorId: string | null }>) => void;
  methods: UseFormReturn<TForm>;
}

export function useHidratacionEditarEmbarque<TForm extends FieldValues>(p: Params<TForm>) {
  // Conceptos venta — hidratar UNA sola vez; después el estado local manda.
  useEffect(() => {
    if (!p.initialized || p.hidratoVenta || p.conceptosVentaDb.length === 0) return;
    p.inicializarVenta(p.conceptosVentaDb.map((v, i) => ({
      id: i + 1,
      dbId: v.id, // v13.207.0 — preservamos UUID para merge en RPC
      concepto: v.descripcion,
      cantidad: v.cantidad,
      precioUnitario: Number(v.precio_unitario),
      moneda: v.moneda,
      contenedorId: v.contenedor_id ?? null,
    })));
    p.setHidratoVenta(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.initialized, p.hidratoVenta, p.conceptosVentaDb]);

  // Conceptos costo — hidratar UNA sola vez.
  useEffect(() => {
    if (!p.initialized || p.hidratoCosto || p.conceptosCostoDb.length === 0) return;
    p.inicializarCosto(p.conceptosCostoDb.map((c, i) => ({
      id: i + 1,
      dbId: c.id, // v13.207.0 — preservamos UUID para merge en RPC
      proveedorId: c.proveedor_id ?? "",
      concepto: c.concepto,
      monto: Number(c.monto),
      moneda: c.moneda,
      contenedorId: c.contenedor_id ?? null,
    })));
    p.setHidratoCosto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.initialized, p.hidratoCosto, p.conceptosCostoDb]);

  // Contactos shipper/consignatario
  useEffect(() => {
    if (!p.initialized || p.hidratoContactos || !p.embarque) return;
    const shipperResuelto = resolverValorContactoDesdeTexto(
      p.embarque.shipper, p.contactos, p.selectedClienteNombre,
    );
    const consigResuelto = resolverValorContactoDesdeTexto(
      p.embarque.consignatario, p.contactos, p.selectedClienteNombre, { permitirCliente: true },
    );
    // SAFE-CAST: setValue espera Path<TForm>; el hook recibe forms heterogéneos.
    const setVal = p.methods.setValue as unknown as (n: string, v: unknown, o?: { shouldDirty?: boolean }) => void;
    setVal("shipper", shipperResuelto.value, { shouldDirty: false });
    setVal("shipperManual", shipperResuelto.manual, { shouldDirty: false });
    setVal("consignatario", consigResuelto.value, { shouldDirty: false });
    setVal("consignatarioManual", consigResuelto.manual, { shouldDirty: false });
    p.setHidratoContactos(true);
  }, [p]);

  // Contenedores
  useEffect(() => {
    if (!p.initialized || p.hidratoContenedores || p.cargandoContenedores) return;
    // SAFE-CAST: setValue genérico.
    const setVal = p.methods.setValue as unknown as (n: string, v: unknown, o?: { shouldDirty?: boolean }) => void;
    setVal("contenedores", p.contenedoresDb.map(rowAContenedorBorrador), { shouldDirty: false });
    p.setHidratoContenedores(true);
  }, [p]);
}
