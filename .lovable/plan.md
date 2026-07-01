## Problema

En `AvanzarEstadoButton.tsx`, cuando faltan documentos para avanzar el estado, el botón se deshabilita y la razón se muestra vía `Tooltip` (hover). En móvil no hay hover, así que el usuario no descubre por qué está bloqueado.

Además, el `<span tabIndex={0}>` envolviendo el botón deshabilitado no dispara el tooltip con tap en Radix móvil de forma confiable.

## Solución

Reemplazar la estrategia "botón deshabilitado + tooltip" por **botón habilitado que abre un AlertDialog explicativo** cuando faltan documentos. Así funciona igual en desktop y móvil, y el usuario ve claramente qué falta y puede navegar a Documentos.

### Cambios

**1. `src/features/embarques/components/header/AvanzarEstadoButton.tsx`**
- Cuando `bloqueadoPorDocs = true`:
  - El botón deja de estar `disabled`; en su lugar, al hacer click abre un `AlertDialog` (reutilizando el estilo del `blockDocsOpen` existente).
  - El diálogo muestra: estado destino, lista de documentos faltantes, botón "Ir a Documentos" y "Cerrar".
  - Se mantiene el `Tooltip` como refuerzo en desktop (hover), pero ya no es la única vía.
- Cuando `cierreBloqueadoPorChecklist = true`: mantener comportamiento actual (ya navega a Cierre al tap) pero asegurar que en móvil el click en el botón dispara `onIrACierre` directamente en vez de depender del `<span>` wrapper.
- Aceptar nueva prop `onIrADocumentos: () => void` para el CTA del nuevo diálogo.

**2. `src/features/embarques/components/EmbarqueDetalleHeaderActions.tsx`**
- Pasar `onIrADocumentos` (ya existe la función en el hook orquestador, la usa `EmbarqueHeaderDialogs`) hacia `AvanzarEstadoButton`.

**3. `src/features/embarques/components/EmbarqueHeaderDialogs.tsx`**
- El diálogo `blockDocsOpen` se vuelve redundante para este caso (el botón ya abre su propio diálogo). Se puede dejar como está (sigue sirviendo si se abre programáticamente desde el hook) o consolidarlo. **Decisión:** dejar `EmbarqueHeaderDialogs` sin cambios y que el nuevo diálogo del botón sea local — evita tocar el hook `useEmbarqueEstadoActions`.

**4. Versionado**
- Bump a `13.142.5` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md`: "Fix móvil: botón Avanzar estado ahora abre diálogo con documentos faltantes en vez de depender de tooltip."

## Detalles técnicos

- No cambia lógica de negocio ni RPCs. Es solo UI/UX del header.
- No modifica `_docs_requeridos_por_estado` ni `embarque_docs_faltantes` (fuente única intacta).
- Respeta memoria `mem://features/candado-docs-avance-estado`: hard block sigue existiendo a nivel RPC.
- Componente sigue bajo 200 líneas.

## Diagrama de flujo

```text
[Botón "Avanzar a EIR"]
        │
        ▼
 ¿bloqueadoPorDocs?
   ├── sí → abre AlertDialog local
   │         ├── Lista de docs faltantes
   │         ├── [Ir a Documentos] → onIrADocumentos()
   │         └── [Cerrar]
   └── no → flujo normal (confirmar avance)
```