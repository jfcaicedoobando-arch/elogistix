## Situación confirmada

En base de datos, 5 de las 10 proformas de tu lista están en la papelera (`deleted_at`):

| Proforma | Cliente | Borrada el |
|---|---|---|
| PRO-2026-0989 | Indimex Trading | 20/07/2026 |
| PRO-2026-0341 | Indimex Trading | 10/07/2026 |
| PRO-2026-0330 | Quimcelt | 24/07/2026 |
| PRO-2026-0284 | Indimex Trading | 13/07/2026 |
| PRO-2026-0281 | Sonomedics | 24/07/2026 |

Las consultas que ya conozco (`fetchProformasTodas`, `fetchProformasListas`, hueco de facturación) **sí** excluyen las borradas tras el fix de v13.321.4. Como aun así las ves, la causa está en otro lado y hay que identificarla antes de tocar código: puede ser (a) estás en la app publicada, que todavía no incluye el fix, o (b) hay una tercera consulta/RPC alimentando esa pantalla que no filtra.

## Plan

### 1. Diagnóstico (primero, sin cambios de código)
- Abrir la pantalla en el preview con navegador automatizado y capturar la petición de red exacta que devuelve las 10 filas: así se ve si viene de la tabla `proformas` sin `deleted_at=is.null` o de un RPC.
- Confirmar la ruta exacta (¿`/proformas`, `/facturacion` pestaña Proformas, o bandeja "Listas para facturar"?).
- Revisar si la vista consultada es el preview o la app publicada.

### 2. Corrección según hallazgo
- Si es otra consulta de frontend: añadir el filtro de papelera y un test de regresión igual al de `queries.test.ts`.
- Si es un RPC de base de datos: migración que agregue `deleted_at IS NULL` a esa función, más un caso en la suite SQL de regresión.
- Si es solo la app publicada: no hay código que cambiar; se publica.

### 3. Auditoría de los borrados
- Consultar `bitacora_actividad` para ver quién y cuándo mandó a la papelera cada una de las 5, y si fue un borrado intencional o accidental.
- Presentarte el resultado antes de restaurar nada.

### 4. Restauración (solo si tú lo pides tras el punto 3)
- Restaurar las que hayan sido error limpiando `deleted_at`, verificando antes que su embarque siga vivo y que no exista otra proforma vigente duplicada para el mismo embarque.

## Detalle técnico
- Fuentes ya verificadas con filtro correcto: `src/features/proformas/services/queries.ts` (4 funciones), `src/features/facturacion/services/proformasListas.ts`, `huecoFacturacion/fetchSources.ts`.
- El persister de React Query solo guarda `tasa_iva` y `exchange-rates`, así que la caché de 24 h no explica el síntoma.
- Cierre con actualización de `CHANGELOG.md` y bump de `APP_VERSION`.
