## Fase G parte 2 — Integración de contenedores dinámicos en el wizard (v12.8.0)

Última fase pendiente del refactor `1 embarque ↔ N contenedores`. Reemplaza los 5 campos sueltos de contenedor en el paso de Ruta marítima por la lista editable creada en Fase C, y persiste los registros child en `embarque_contenedores` al guardar.

### 1. Form values + defaults
**`src/lib/mappers/embarqueFromDb.ts`**
- Añadir `contenedores: ContenedorBorrador[]` a `EmbarqueFormValues` (default `[]` en `DEFAULT_EMBARQUE_VALUES`).
- `mapEmbarqueRowToFormValues`: dejar `contenedores: []` (se hidratan aparte cuando exista flujo de edición; fuera de alcance ahora).

### 2. Validación Zod del paso 2 (marítimo)
**`src/lib/domain/embarqueWizardSchemas.ts`**
- Reemplazar las reglas legacy de `contenedor` / `tipoContenedor` por una validación de `contenedores`:
  - FCL: `contenedores.length >= 1`, y cada item válido contra `contenedorBorradorSchema` (num + tipo obligatorios).
  - LCL: `contenedores.length === 1` y `tipo_contenedor === "LCL"` (auto-inyectado). Número opcional (`contenedorBorradorLclSchema`).
- Mensajes nuevos en `errorCatalog.ts`: `2.contenedores.minOne`, `2.contenedores.item.invalid`.
- Actualizar `StepRutaInput` para incluir `contenedores`, `tipoServicio`, `modo`.

### 3. UI Wizard — Step Marítimo
**`src/components/embarque/stepDatosRuta/StepDatosRutaMaritimo.tsx`**
- Borrar los bloques "# Contenedor" y "Tipo Contenedor" (líneas 58‑80).
- Añadir sección "Contenedores *" con `<Controller name="contenedores">` envolviendo `ListaContenedoresEditable`.
- Si `tipoServicio === 'LCL'`: forzar `value=[{ numero_contenedor:'', tipo_contenedor:'LCL', ... }]`, render readonly informativo (no usar la lista editable; mostrar `Input disabled="LCL (Carga Consolidada)"`).
- Al cambiar `tipoServicio` de LCL → FCL: limpiar `contenedores` a `[crearContenedorVacio(1)]`.
- Mostrar `errors['contenedores']` y errores por fila (`contenedores.0.numero_contenedor`, etc.).

### 4. Submit orchestrator
**`src/hooks/embarque/useEmbarqueSubmitOrchestrator.ts`** + **`mutations/useCreateEmbarque.ts`**
- Extender `CreateEmbarqueInput` con `contenedores: ContenedorBorrador[]`.
- Tras `crearEmbarqueRpc(...)` exitoso, llamar `crearMuchos(embarqueId, contenedores)` solo si `values.modo === 'Marítimo'` y `contenedores.length > 0`. Si falla: `notifyWarning` (no bloqueante; el embarque ya existe y el trigger DB mantiene campos legacy).
- Pasar `contenedores` desde `useNuevoEmbarqueWizard.handleFinish` (`methods.getValues().contenedores`).

### 5. Limpieza de payload legacy
**`src/lib/mappers/embarque.ts`** (build payload)
- Cuando `modo === 'Marítimo'` y `contenedores.length > 0`: derivar `contenedor`, `tipo_contenedor`, `peso_kg`, `volumen_m3`, `piezas` del primer contenedor para mantener compatibilidad inmediata (antes de que corra el trigger).
- LCL: mantener `tipo_contenedor: 'LCL'`.

### 6. Tests
- Actualizar `embarqueWizardSchemas.test.ts`: casos FCL con 0, 1 y 2 contenedores; LCL auto-LCL; mensaje cuando un item no tiene número.
- Smoke en mapper: `buildEmbarquePayload` deriva campos legacy del primer contenedor.

### 7. Versionado / Docs
- `APP_VERSION` → `12.8.0` (`src/constants/appVersion.ts`).
- `CHANGELOG.md`: nueva entrada `## [12.8.0]` con bullets: wizard integra lista dinámica de contenedores, validación zod por item, submit inserta en `embarque_contenedores`, campos legacy quedan como espejo.
- `docs/embarques-contenedores.md`: añadir sección "Flujo wizard v12.8".
- `.lovable/plan.md`: marcar Fase G como completa.

### Detalles técnicos
- Sin migraciones DB (todo está listo desde Fase A/B).
- La hidratación de `contenedores` al **editar** un embarque existente queda fuera (el detail-view ya usa `SeccionContenedores` con `reemplazarTodos`).
- El trigger DB sincroniza `embarques.contenedor` etc. desde `embarque_contenedores`, por eso la derivación en el payload es solo defensiva para reportes inmediatos.

### Fuera de alcance
- Eliminar columnas legacy de `embarques` (futuro, cuando todos los reportes migren a la tabla child).
- Hidratar `contenedores` en flujo de edición desde URL/expediente.
- UI por contenedor en steps de costos (Fase E ya cubre filtrado en proformas).