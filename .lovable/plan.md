# Corrección de bugs: UI de tarifas/embarques + candados de cierre y concurrencia

Alcance mínimo (YAGNI): sólo se corrigen los puntos confirmados. No se agregan módulos, tablas ni pantallas nuevas. B-3, B-4 y B-5 quedan documentados como pendientes, sin implementar.

## Orden de trabajo

1. MR-UI-01 — título de la pestaña
2. A-1 y A-2 — bloqueo por embarque cerrado
3. A-3 — doble aprobación de factura de proveedor
4. B-1 y B-2 — aislamiento por organización activa
5. MR-UI-02 y MR-UI-03 — densidad de la tabla de tarifas y contador de contenedores

## 1. MR-UI-01 — la pestaña dice "Iniciar sesión"

La pantalla de tarifas sí fija su propio título, pero el gancho de título restaura el título anterior al desmontarse. Al entrar desde el inicio de sesión, la pantalla vieja se desmonta *después* de que la nueva ya fijó el suyo, y lo sobrescribe.

Corrección: al restaurar, sólo hacerlo si el título actual sigue siendo el que ese componente puso. Un cambio en `useDocumentTitle`, con prueba.

## 2. A-1 / A-2 — edición después de cerrar el embarque

Hoy el candado de "embarque cerrado" cubre conceptos y algunas tablas, pero no todas.

- A-1: la función que cambia el estado de una garantía de contenedor no valida el cierre. Se agrega la misma validación que ya usan los conceptos (con el mismo mensaje y el mismo bypass controlado de re-apertura).
- A-2: se extiende el disparador de bloqueo existente a `pagos_factura`, `pagos_proveedor`, `facturas`, `proveedor_facturas`, `comisiones_devengadas` y `embarque_facturas_entrantes`, resolviendo el embarque asociado (directo o vía factura/concepto según la tabla).

Se respeta el bypass de re-apertura ya existente, de modo que reabrir el embarque sigue permitiendo corregir y deja traza.

## 3. A-3 — doble aprobación concurrente

`aprobar_factura_proveedor` lee la factura sin bloquearla. Dos clics simultáneos pueden aprobar y rechazar a la vez.

Corrección: leer la factura `FOR UPDATE` y re-verificar el estado dentro del bloqueo; si ya cambió, devolver un resultado idempotente con mensaje claro en lugar de duplicar efectos.

## 4. B-1 / B-2 — organización activa

- B-1: las funciones que aún usan la organización "primera membresía" se alinean al ámbito de tenant activo, para que un super administrador nunca vea o escriba en otra organización que la seleccionada.
- B-2: al cambiar de organización en el selector, la interfaz espera la confirmación del cambio antes de refrescar datos, evitando la ventana en que la pantalla ya cambió pero la base todavía no.

## 5. MR-UI-02 — tabla de tarifas en pantallas de 1280 px

Ajuste visual: anchos y densidad de columnas para que Total, Vigencia y Estado entren en el primer vistazo, más un indicador claro de que la tabla se desliza a lo ancho cuando aún haga falta. Sin cambios de datos ni de cálculo.

## 6. MR-UI-03 — contador de contenedores

En algunas etiquetas el número mostrado corresponde a embarques agrupados, no a contenedores. Se corrige para contar los contenedores reales del bloque (el caso MSCU2609081 +1 debe mostrar 2).

## Notas técnicas

- Cambios de base vía migración, con espejos en `supabase/schema/**` sincronizados y `GRANT`/`REVOKE` conservados (`_cxp_validar_aprobacion` y compañía siguen siendo sólo `service_role`).
- Se agregan pruebas SQL focalizadas para el candado de cierre y para la doble aprobación.
- Validación local: typecheck, lint y pruebas focalizadas, `audit:schema-functions`, `audit:manifest`, `db:postcheck` y build. CI, RLS globales y E2E quedan para GitHub Actions.
- Bump de `APP_VERSION` + entrada en `CHANGELOG.md`.

## Fuera de alcance (pendientes declarados)

- B-3 idempotencia en `registrar_pago_liquidacion`
- B-4 congelado de `pnl_base` antes de recalcular comisiones
- B-5 prorrateo de costos cotización → embarque por cantidad
