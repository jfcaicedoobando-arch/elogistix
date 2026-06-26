# Mover card "Demoras automáticas" al tab de Garantías y Demoras

## Por qué
Hoy `SeccionDemorasAuto` (botón "Recalcular demoras" + eliminar automáticas) vive dentro de `TabCostos`, mezclado con la tabla de conceptos manuales. La acción opera sobre datos que el usuario captura en el tab **Garantías y Demoras** (fechas de descarga/devolución por contenedor, tabulador de la naviera, días libres). Moverlo agrupa captura → cálculo → resultado en un solo lugar y deja Costos enfocado en conceptos.

## Cambios (sólo presentación, sin tocar lógica)

1. **`src/features/embarques/components/TabCostos.tsx`**
   - Quitar el import de `SeccionDemorasAuto`.
   - Quitar el render `{embarqueId && <SeccionDemorasAuto … />}` al final del tab.

2. **`src/features/embarques/components/EmbarqueDetalleTabs.tsx`** (tab `garantias`)
   - Dentro de la sección `seccion-demoras`, renderizar `SeccionDemorasAuto` arriba de `TabDemoras` (orden: acción de recálculo → tabla de contenedores/días).
   - Mantener separadores y títulos actuales.

3. **Bitácora del proyecto**
   - `CHANGELOG.md`: nueva entrada con bump de patch.
   - `src/constants/appVersion.ts`: subir versión.

## Lo que NO cambia
- `SeccionDemorasAuto.tsx` y los hooks `useRecalcularDemoras` / `useEliminarDemorasAuto` quedan igual.
- RPC `calcular_demoras_embarque` y la generación de conceptos (`origen = 'demoras_auto'`) no se tocan.
- Permisos (`canEdit`) y mensajes de toast se preservan.

## Verificación
- Abrir un embarque → tab **Costos**: ya no aparece el card de demoras automáticas.
- Tab **Garantías y Demoras**: bajo "Demoras" aparece primero el card de recálculo y luego la tabla por contenedor.
- `bun run lint` limpio.
