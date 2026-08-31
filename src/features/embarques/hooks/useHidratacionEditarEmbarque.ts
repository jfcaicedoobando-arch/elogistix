/**
 * Efectos de hidratación para EditarEmbarque. Extraído de useEditarEmbarqueWizard
 * para mantener el controller bajo el límite Power of 10 (<200 líneas).
 */
import { useEffect, useMemo, useRef } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import { rowAContenedorBorrador } from "@/features/embarques/types/contenedor";
import { resolverValorContactoDesdeTexto } from "@/features/cliente/domain/contacto";
import { resolverProveedorIdPorNombre, type ProveedorCatalogo } from "@/features/embarques/domain/resolverProveedor";

interface ConceptoVentaDb {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number | string;
  moneda: string;
  contenedor_id: string | null;
  estado_facturacion?: string | null;
}
interface ConceptoCostoDb {
  id: string;
  proveedor_id: string | null;
  proveedor_nombre?: string | null;
  concepto: string;
  monto: number | string;
  moneda: string;
  contenedor_id: string | null;
  estado_liquidacion?: string | null;
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
  /** Catálogo de proveedores para resolver el nombre heredado → id. */
  proveedoresDb?: ReadonlyArray<ProveedorCatalogo>;
  inicializarVenta: (rows: Array<{ id: number; dbId?: string | null; concepto: string; cantidad: number; precioUnitario: number; moneda: string; contenedorId: string | null; estadoFacturacion?: string | null }>) => void;
  inicializarCosto: (rows: Array<{ id: number; dbId?: string | null; proveedorId: string; proveedorNombre?: string | null; concepto: string; monto: number; moneda: string; contenedorId: string | null; estadoLiquidacion?: string | null }>) => void;
  methods: UseFormReturn<TForm>;
}

export function useHidratacionEditarEmbarque<TForm extends FieldValues>(p: Params<TForm>) {
  // Refs a los setters/inicializadores para no re-suscribir los efectos de
  // hidratación cuando el padre recrea las callbacks en cada render.
  const inicializarVentaRef = useRef(p.inicializarVenta);
  const inicializarCostoRef = useRef(p.inicializarCosto);
  const setHidratoVentaRef = useRef(p.setHidratoVenta);
  const setHidratoCostoRef = useRef(p.setHidratoCosto);
  inicializarVentaRef.current = p.inicializarVenta;
  inicializarCostoRef.current = p.inicializarCosto;
  setHidratoVentaRef.current = p.setHidratoVenta;
  setHidratoCostoRef.current = p.setHidratoCosto;

  // Conceptos venta — hidratar UNA sola vez; después el estado local manda.
  useEffect(() => {
    if (!p.initialized || p.hidratoVenta || p.conceptosVentaDb.length === 0) return;
    inicializarVentaRef.current(p.conceptosVentaDb.map((v, i) => ({
      id: i + 1,
      dbId: v.id, // v13.207.0 — preservamos UUID para merge en RPC
      concepto: v.descripcion,
      cantidad: v.cantidad,
      precioUnitario: Number(v.precio_unitario),
      moneda: v.moneda,
      contenedorId: v.contenedor_id ?? null,
      // Ola 5 — el estado viaja a la fila para bloquear la edición fantasma
      // de conceptos ya facturados (la RPC los descarta en silencio).
      estadoFacturacion: v.estado_facturacion ?? null,
    })));
    setHidratoVentaRef.current(true);
  }, [p.initialized, p.hidratoVenta, p.conceptosVentaDb]);

  // Conceptos costo — hidratar UNA sola vez.
  // v13.509.0 — Si el costo trae nombre de proveedor pero no id (costos
  // replicados de cotización), lo resolvemos contra el catálogo y en todo caso
  // conservamos el nombre para no perderlo al guardar.
  const proveedoresDb = useMemo(() => p.proveedoresDb ?? [], [p.proveedoresDb]);
  useEffect(() => {
    if (!p.initialized || p.hidratoCosto || p.conceptosCostoDb.length === 0) return;
    if (proveedoresDb.length === 0) return;
    inicializarCostoRef.current(p.conceptosCostoDb.map((c, i) => ({
      id: i + 1,
      dbId: c.id, // v13.207.0 — preservamos UUID para merge en RPC
      proveedorId: c.proveedor_id ?? resolverProveedorIdPorNombre(c.proveedor_nombre, proveedoresDb),
      proveedorNombre: c.proveedor_nombre ?? null,
      concepto: c.concepto,
      monto: Number(c.monto),
      moneda: c.moneda,
      contenedorId: c.contenedor_id ?? null,
      estadoLiquidacion: c.estado_liquidacion ?? null,
    })));
    setHidratoCostoRef.current(true);
  }, [p.initialized, p.hidratoCosto, p.conceptosCostoDb, proveedoresDb]);

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
