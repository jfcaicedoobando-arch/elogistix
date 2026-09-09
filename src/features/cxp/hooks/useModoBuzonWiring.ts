/**
 * v13.510.0 — Cableado del "modo buzón" del modal de captura: herencia de lo
 * declarado por operaciones, autocarga del CFDI, conceptos sugeridos y la
 * categoría contable fijada en COGS.
 *
 * Vive aparte para que el componente del diálogo se mantenga simple.
 */
import { useAutocargaEntrante } from "./useAutocargaEntrante";
import { useHerenciaEntrante } from "./useHerenciaEntrante";
import { useCategoriaCogsBuzon } from "./useCategoriaCogsBuzon";
import { usePrefillVinculosEntrante } from "./usePrefillVinculosEntrante";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import type { useNuevaFacturaProveedorForm } from "./useNuevaFacturaProveedorForm";
import type { CategoriaPresupuestoLite, EntranteParaCaptura } from "@/features/cxp/types";

interface Args {
  ctl: ReturnType<typeof useNuevaFacturaProveedorForm>;
  categorias: CategoriaPresupuestoLite[];
  entrante: EntranteParaCaptura | null | undefined;
  abierto: boolean;
}

export function useModoBuzonWiring({ ctl, categorias, entrante, abierto }: Args) {
  const autocarga = useAutocargaEntrante({
    entrante, abierto, categorias,
    onCfdiParsed: ctl.handleCfdiParsed, onPdfParsed: ctl.handlePdfIaParsed,
  });

  useHerenciaEntrante({
    entrante, abierto,
    provIdActual: ctl.values.provId,
    notaActual: ctl.values.notas,
    onProveedor: (id, nombre) => ctl.handleProveedor(id, nombre),
    onNota: (nota) => ctl.handleChange("notas", nota),
  });

  const categoriaCogs = useCategoriaCogsBuzon({
    categorias,
    documentoId: entrante?.id ?? null,
    expediente: entrante?.expediente ?? null,
    abierto,
    categoriaActual: ctl.values.categoriaId,
    onCategoria: (id) => ctl.handleChange("categoriaId", id),
  });

  // Fix ELIMP00329: el importe pre-marcado debe ir en la moneda de la factura,
  // convertido con el T/C DOF de la emisión (igual que la marca manual).
  const { data: tcDof } = useTcDofPorFecha(
    ctl.values.emision || null,
    Boolean(abierto && ctl.values.emision),
  );

  const herencia = usePrefillVinculosEntrante({
    entrante, abierto, habilitado: Boolean(ctl.values.provId),
    aplicarSugerencias: ctl.aplicarSugerencias,
    facturaMoneda: ctl.values.moneda,
    tc: tcDof ? { usdMxn: tcDof.usdMxn, eurMxn: tcDof.eurMxn } : null,
  });

  return { autocarga, categoriaCogs, herencia };
}
