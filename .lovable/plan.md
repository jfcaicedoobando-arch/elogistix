## v12.14.1 — Cierre de pendientes Fase 6

Cuatro mejoras pequeñas para cerrar el plan original + indicador visual para los embarques con captura incompleta.

### 1. Validación cross-embarque en consolidar (verificación + mensajes)
- Verificar que la RPC `consolidar_proformas` ya bloquea proformas de embarques o clientes distintos. Si no lo hace, agregar guard en el wrapper `consolidarProformas` (cliente) que valide antes del RPC: todas las proformas deben compartir `embarque_id` y `cliente_id`.
- En `TabProformasPendientes`, el tooltip ya dice "Solo puedes consolidar proformas del mismo expediente". Agregar segundo mensaje contextual si las proformas tienen cliente distinto (caso teórico pero defensivo).
- Si la RPC retorna error, mapear a un mensaje en español claro en el toast (hoy probablemente sale el error crudo de Postgres).

### 2. Comentario explícito del fallback de días de crédito
En `useDialogGenerarProformaController.handleConfirmar`: agregar JSDoc en el cálculo de `diasCreditoNum` para documentar que `'' → null → 0` se interpreta como Contado a nivel DB. Cosmético, una línea.

### 3. Documentación
Actualizar `docs/embarques-contenedores.md` con una sección nueva:
- Cómo el flujo de proformas refleja el modelo 1↔N (agrupación en `ResumenConceptosVenta`, atajo "Por contenedor", PDFs agrupados).
- Convención `contenedor_id = null` = cargo general del BL.
- Bucket `__multi__` en `agruparProformasPendientes`.

### 4. Badge "Datos pendientes" en lista de embarques
Para los embarques marítimos sin número de contenedor / BL master / naviera capturados (caso ELIMP00231 y los 8 reportados):

**4a. Enriquecer `useContenedoresInfoMap`** para devolver también `incompletos: number` (contenedores con `numero_contenedor` vacío o `tipo_contenedor` vacío).

**4b. Nueva columna o badge en `embarqueColumns.tsx`** que muestra `Datos pendientes` (badge naranja `warning`) cuando:
- el embarque es marítimo y
- `info.incompletos > 0` **o** `bl_master` es null/vacío.

Posición: junto a la columna "Contenedores" o como subbadge debajo del número. Tooltip detallando qué falta (BL, número de contenedor, tipo).

**4c.** No bloquear nada, sólo flag visual para que el operador sepa qué embarques aún requieren captura manual.

### Detalles técnicos
- Sin migraciones SQL.
- `useContenedoresInfoMap`: extender el `select` para traer también `tipo_contenedor`; contar en cliente los que tengan strings vacíos.
- `embarqueColumns`: el badge usa el variant `warning` ya existente del design system.
- Mantener componentes ≤200 líneas (el archivo `embarqueColumns.tsx` está cerca; si crece >200 al añadir el badge, extraer una mini función `renderContenedorCell`).

### Entregables
1. Guard cliente + mensaje claro en `consolidar.ts` y `TabProformasPendientes`.
2. JSDoc en `useDialogGenerarProformaController`.
3. Sección nueva en `docs/embarques-contenedores.md`.
4. `useContenedoresInfoMap` enriquecido + badge "Datos pendientes" en lista de embarques.
5. `CHANGELOG.md` `## [12.14.1]` + bump `APP_VERSION`.

### Out of scope
- Editar números de contenedor / BL desde la lista (sigue siendo via EditarEmbarque).
- Auto-cerrar la entrada de captura: el badge sólo informa.
