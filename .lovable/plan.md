

## Plan: Botón eliminar cotización (solo admin)

### Cambios

**1. `src/hooks/useCotizaciones.ts`** — Agregar `useDeleteCotizacion`

```ts
export function useDeleteCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cotizaciones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
    },
  });
}
```

**2. `src/pages/Cotizaciones.tsx`** — Columna de acciones con botón eliminar

- Importar `Trash2`, `AlertDialog` components, `useDeleteCotizacion`, `useToast`
- Agregar estado `cotizacionAEliminar` para controlar el dialog
- Extraer `isAdmin` de `usePermissions()`
- Agregar columna "Acciones" al header (solo si `isAdmin`)
- En cada fila, agregar celda con botón `Trash2` que abre `AlertDialog` (con `e.stopPropagation()` para no navegar)
- AlertDialog con doble confirmación (protocolo de seguridad existente): título "¿Eliminar cotización?", descripción "Esta acción no se puede deshacer."
- Al confirmar: `deleteCotizacion.mutateAsync(id)` → toast éxito
- Actualizar `colSpan` del mensaje vacío de 8 a 9 cuando es admin

**3. `src/pages/Changelog.tsx`** — entrada v4.12.0

