## Objetivo
Ocultar el bloque "Crear nuevo expediente / Asociar a expediente existente" cuando se está **editando** un embarque. En la edición ese bebé ya está bautizado: mostrar de nuevo los radios solo confunde y además no tienen handlers funcionales en `EditarEmbarque.tsx`.

En **crear-embarque** el bloque se mantiene tal cual.

## Cambios

1. **`StepDatosGenerales.tsx`**
   - Añadir prop opcional `mostrarSelectorExpediente?: boolean` (default `true`).
   - Pasarla a `BloqueVinculacion` como `permiteExpediente`.

2. **`BloqueVinculacion.tsx`**
   - Aceptar `permiteExpediente?: boolean` (default `true`).
   - Cuando sea `false`, no renderizar la sección de Expediente (radios "Crear nuevo" / "Asociar existente" y su input asociado).
   - La sección de Cotización sigue visible en ambos flujos.

3. **`EditarEmbarque.tsx`**
   - Pasar `mostrarSelectorExpediente={false}` al `StepDatosGenerales`.

4. **`APP_VERSION`** → `13.303.25`.

5. **`CHANGELOG.md`** (root): entrada `## [13.303.25]` con bullet:
   - UX: al editar un embarque se oculta el selector de expediente (crear/asociar), que ya no aplica una vez el embarque está asignado.

## Fuera de alcance
- No se toca la lógica de creación de expedientes en el flujo de nuevo embarque.
- No se elimina código de `BloqueVinculacion`; solo se hace condicional para poder reutilizarlo.

## Analogía
En "crear embarque" el expediente es el bautizo: eliges nombre nuevo o lo apellidas con una familia existente. En "editar embarque" el bebé ya está bautizado — repetir esos radios solo confunde. Los ocultamos ahí.
