

## Plan: Agregar botón "Generar Embarques" y card de embarques vinculados en CotizacionDetalle

### Archivo único: `src/pages/CotizacionDetalle.tsx`

**1. Imports adicionales (líneas 1-28)**
- `useConvertirCotizacionAEmbarques` desde `@/hooks/useCotizaciones`
- `useQuery` desde `@tanstack/react-query`
- `supabase` desde `@/integrations/supabase/client`
- `ArrowRight` desde `lucide-react`
- `AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle` desde `@/components/ui/alert-dialog`

**2. Hooks y estado (después de línea 37)**
- `useQuery` para cargar `embarquesVinculados` filtrando por `cotizacion_id`
- Estado `showConfirmarConvertir`
- Hook `convertirAEmbarques = useConvertirCotizacionAEmbarques()`

**3. Botón en sección de acciones (línea ~152)**
- Cuando `esAceptada`, agregar botón "Generar Embarques" con badge de `num_contenedores`
- onClick abre el AlertDialog de confirmación

**4. AlertDialog de confirmación (antes del cierre del div principal)**
- Título: "¿Generar embarques?"
- Descripción con número de contenedores y reglas de copia
- Botón confirmar ejecuta `convertirAEmbarques.mutateAsync(cotizacion)`, muestra toast y cierra

**5. Card "Embarques Generados" (al final, antes del cierre)**
- Visible cuando `estado === 'Convertida'` o `embarquesVinculados.length > 0`
- Lista cada embarque con expediente clickeable, badge de estado y fecha
- Skeleton si no hay datos aún

**6. Changelog**: Entrada v4.9.5

