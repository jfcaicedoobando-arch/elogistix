# Dictamen del parche `fixes_03_workflows_rbac_ux.diff`

Revisé cada hallazgo contra el código y la base de datos reales. De los 7 grupos, **3 son bugs que vale la pena corregir**, 2 son mejoras menores opcionales, 1 se descarta por decisión tuya y 1 se descarta porque ya está resuelto.

## Bugs reales que sí se corrigen

### B-06 — Cualquiera puede firmar la bitácora con el correo que quiera (severidad alta)
Las funciones `avanzar_estado_embarque` y `reabrir_embarque` reciben el correo del usuario **como texto enviado desde el navegador** y lo escriben tal cual en las notas y eventos del expediente. Es como una bitácora de visitas donde cada quien escribe el nombre que se le ocurre: el registro deja de servir como evidencia.

El parche sólo quita el dato del frontend, pero las funciones lo exigen (no es opcional), así que aplicado tal cual **rompe** cambiar de estado y reabrir embarques. Además edita un archivo autogenerado, lo cual no está permitido.

Corrección: primero una migración que haga el parámetro opcional y derive el actor real de la sesión autenticada (ignorando lo que mande el cliente), y después el ajuste del frontend y sus pruebas.

### B-05 — Embarque creado y cotización sin vincular, avisado en voz baja (severidad media)
Hoy, si el embarque se crea pero falla el paso de marcar la cotización "En operación" y ligarla, sale un aviso discreto y el flujo termina "en verde". Resultado: cotización aceptada sin vínculo y expediente huérfano de su origen comercial.

Corrección (con tu decisión): dos reintentos con espera creciente y, si aún falla, **error visible** con el número de expediente y la cotización a reconciliar, pero **continuando al embarque** para que nadie lo cree dos veces.

### B-25 — La cartera en celular muestra "-5d" de vencimiento (severidad baja, arreglo barato)
En la tabla de escritorio una factura que aún no vence dice "Vence en 5d"; en la lista móvil el mismo caso muestra `-5d`, que se lee como un dato roto. Corrección: "Vigente / Vence hoy / Vencida Nd", igual que en escritorio.

## Mejoras menores (se incluyen porque son de bajo riesgo)

### B-11/B-12 — Mensaje en vez de rebote mudo al editar una cotización en operación
El candado ya existe: sólo se edita en `Borrador` y `Solicitada`, así que las 86 cotizaciones "En operación" ya están protegidas. Lo que falta es explicación: hoy el sistema te rebota al detalle sin decir por qué. Se añade una pantalla "Edición bloqueada" con el motivo.

También hay 12 cotizaciones en `Borrador`/`Solicitada` que ya tienen embarque ligado; para ésas se bloquea la edición con el mismo mensaje, porque cambiarlas desincroniza venta y costos del expediente.

## No se aplican

- **B-07 (costos por rol)** — Descartado por tu indicación: vendedor y ejecutivo de pricing siguen viendo Costo, Utilidad y Margen. No se toca la matriz de permisos.
- **B-26 (reintentos al marcar hallazgos revisados en lote)** — El proceso ya es idempotente y ya reporta fallos parciales con detalle. Añadir reintentos con espera sólo agrega complejidad a una pantalla interna de auditoría; no hay evidencia de fallos reales.
- **B-27 (paginación por cursor en la bitácora)** — La tabla tiene 9,577 filas y el conteo ya está optimizado; el problema teórico (una fila repetida al paginar si alguien inserta al mismo tiempo) no justifica reescribir la paginación y arrastrar un tipo nuevo por toda la cadena.

## Detalles técnicos

1. **Migración** (`p_usuario_email` deja de ser confiable):
   - `avanzar_estado_embarque` y `reabrir_embarque`: parámetro con `DEFAULT NULL`, y el actor se resuelve server-side (`auth.jwt() ->> 'email'`, con respaldo en el perfil del usuario y en el valor recibido sólo si no hay sesión, p. ej. procesos internos).
   - Se mantiene la firma completa para no romper llamadas existentes; `GRANT EXECUTE` sin cambios.
   - `supabase/schema/` y `baseline.sql` se sincronizan para que no falle el guard de esquema del CI.
2. **Frontend B-06**: `embarqueEstadoRpc.ts`, `cierre.ts`, `useEstadoEmbarque.ts`, `useEmbarqueEstadoActions*`, `useEmbarqueReabrirCancelar.ts`, `useCierreEmbarque.ts` dejan de enviar el correo; se actualizan las pruebas correspondientes. No se edita `src/integrations/supabase/types.ts` (se regenera solo tras la migración).
3. **B-05**: `useEmbarqueSubmitOrchestrator.ts` con reintentos 500/1000 ms, `notifyError` con expediente y folio, y navegación al embarque (`return true`).
4. **B-11/B-12**: `motivoBloqueoEdicionCotizacion` en `estadosEditables.ts` + pantalla de bloqueo en `EditarCotizacion.tsx`; pruebas del dominio.
5. **B-25**: `CarteraMobileList.tsx` reusando la misma lógica de etiqueta que `carteraColumns.tsx`.
6. Cierre: `bun run lint`, `tsgo`, pruebas afectadas, suites RLS de operaciones, `CHANGELOG.md` y `APP_VERSION` → `13.749.0`.
