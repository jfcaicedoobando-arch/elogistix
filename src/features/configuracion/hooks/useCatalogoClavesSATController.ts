/**
 * Controlador del catálogo de claves SAT (productos/servicios): carga, alta,
 * edición y baja, con invalidación de queries relacionadas.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import {
  fetchCatalogoClavesSat,
  insertCatalogoClaveSat,
  updateCatalogoClaveSat,
  deleteCatalogoClaveSat,
} from "@/features/configuracion/services/catalogoClavesSat";
import { tasaFromTipo, type Draft, type Row } from "@/features/configuracion/components/CatalogoClavesSATCard.constants";

export function useCatalogoClavesSATController() {
  const { organizationId } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: queryKeys.configuracion.catalogoClavesSat(organizationId),
    enabled: !!organizationId,
    // SAFE-CAST: el service devuelve el row canónico; Row local es un alias estructural del mismo shape.
    queryFn: fetchCatalogoClavesSat as unknown as () => Promise<Row[]>,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.configuracion.catalogoClavesSat(organizationId) });
    qc.invalidateQueries({ queryKey: queryKeys.productosCatalogo(organizationId) });
  };

  const onError = (err: unknown) =>
    notifyError(undefined, { title: "No se pudo guardar el producto", error: err, method: "CATALOGO_PRODUCTOS" });

  const buildPayload = (d: Draft) => ({
    patron: d.patron.trim(),
    clave_sat: d.clave_sat.trim(),
    activo: d.activo,
    tipo_iva: d.tipo_iva,
    tasa_iva_default: tasaFromTipo(d.tipo_iva),
    clave_unidad_sat: d.clave_unidad_sat,
  });

  const addMut = useMutation({
    mutationFn: async (d: Draft) => {
      if (!organizationId) throw new Error("Sin organización");
      await insertCatalogoClaveSat(organizationId, buildPayload(d));
    },
    onSuccess: () => { invalidate(); notifySuccess(undefined, { title: "Producto agregado" }); },
    onError,
  });

  const updateMut = useMutation({
    mutationFn: async (vars: { id: string; d: Draft }) => {
      await updateCatalogoClaveSat(vars.id, buildPayload(vars.d));
    },
    onSuccess: () => { invalidate(); notifySuccess(undefined, { title: "Producto actualizado" }); },
    onError,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await deleteCatalogoClaveSat(id);
    },
    onSuccess: () => { invalidate(); notifySuccess(undefined, { title: "Producto eliminado" }); },
    onError,
  });

  return { rows, isLoading, addMut, updateMut, deleteMut };
}
