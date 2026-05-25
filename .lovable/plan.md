## Objetivo

Permitir duplicar un embarque desde su propia página de detalle. El hook `useDuplicarEmbarque` y el RPC `duplicarEmbarqueRpc` siguen vivos en el código — sólo se eliminó el componente UI en v11.46.0 (cleanup de bloatware). Aquí se reintroduce, pero ahora dentro del detalle (no en la lista).

## Alcance

1. **Nuevo componente** `src/components/embarque/DialogDuplicarEmbarque.tsx`
   - Diálogo con formulario para definir N copias (mín 1, máx 10).
   - Por cada copia: `num_contenedor`, `tipo_contenedor` (catálogo), `peso_kg`, `volumen_m3`, `piezas`.
   - Prefilleo de la primera copia con los valores del embarque origen.
   - Validación con zod (mismos campos que el RPC espera).
   - Usa `useDuplicarEmbarque()` ya existente.
   - Al éxito: toast con `appFeedback`, invalida embarques, cierra diálogo y navega al nuevo embarque (si el RPC devuelve `id`) o regresa a `/embarques` si devuelve varios.

2. **Integración en `EmbarqueDetalle.tsx`**
   - Nuevo `useState` `dialogDuplicarAbierto`.
   - Pasar `onAbrirDuplicar` al `EmbarqueDetalleHeader`.
   - Renderizar `<DialogDuplicarEmbarque>` junto al de eliminar.

3. **`EmbarqueDetalleHeader.tsx`**
   - Nuevo prop `onAbrirDuplicar: () => void`.
   - Agregar `DropdownMenuItem` "Duplicar embarque" (icono `Copy`) arriba del separador de eliminar, gated por `canEdit`.

4. **Versionado**
   - `APP_VERSION` → `11.47.0`.
   - Entrada en `CHANGELOG.md` raíz: "Reimplementa duplicación de embarques desde el detalle".

## Fuera de alcance

- No se reintroduce el botón en la lista `/embarques` (decisión: el detalle es el lugar correcto, evita re-añadir bloat eliminado).
- No se modifica el RPC ni el servicio — ya funcionan.
- No se cambia la UX de creación normal de embarques.

## Detalles técnicos

- `useDuplicarEmbarque` retorna lo que devuelva `duplicarEmbarqueRpc`. Verificar la forma exacta del retorno antes de implementar la navegación post-éxito (puede devolver `{ ids: string[] }` o similar). Si devuelve múltiples ids, mostrar toast con conteo y volver a `/embarques`; si devuelve uno, navegar a `/embarques/:id`.
- Para el catálogo de tipos de contenedor usar `useTiposContenedor` ya existente.
- Idempotencia: generar `requestId` por submit con `newRequestId()` (ya lo hace el hook por default).
- Sin cambios de base de datos.

## Archivos afectados

```text
src/components/embarque/DialogDuplicarEmbarque.tsx        (nuevo)
src/components/embarque/EmbarqueDetalleHeader.tsx         (prop + item dropdown)
src/pages/embarques/EmbarqueDetalle.tsx                   (state + render)
src/constants/appVersion.ts                               (11.47.0)
CHANGELOG.md                                              (entrada nueva)
```
