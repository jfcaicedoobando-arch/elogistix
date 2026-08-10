# Permisos contables: sí a movimientos bancarios, no a subir facturas de proveedor

Dos ajustes de permisos, cada uno alineado en base de datos y en la interfaz (misma regla en los dos lados, para que nunca aparezca un botón que la base rechace).

## 1. Contabilidad podrá capturar, editar e importar movimientos bancarios

Hoy la base sólo permite crear/editar movimientos en conciliación al tesorero y a los administradores; contador y auxiliar contable tienen sólo lectura (por eso salía el error de permisos al intentar guardar).

Cambios:
- Ampliar las reglas de escritura de movimientos bancarios para incluir contador y auxiliar contable (crear, editar e importar), conservando tesorero y administradores. El aislamiento por organización se mantiene intacto.
- La interfaz de Tesorería → Conciliación volverá a mostrar a estos roles los botones "Movimiento manual", "Importar XLSX/CSV" y "Eliminar movimiento manual".

## 2. Contabilidad ya no subirá facturas de proveedor recibidas en el embarque

En el tab de **Costos** del embarque, la tarjeta "Facturas de proveedor recibidas" es el buzón donde operaciones entrega los PDF/XML del agente. Hoy contador y auxiliar contable también pueden subir ahí; se les quitará (segregación de funciones: operación entrega, contabilidad captura).

Cambios:
- Quitar a contador y auxiliar contable de la regla de subida del buzón de facturas entrantes del embarque; quedan operaciones (operador, coordinador logístico, gerente de operaciones) y administradores.
- En la tarjeta, el botón "Subir factura" queda oculto para roles contables, con una nota corta explicando que la entrega la hace operaciones.
- Contabilidad conserva todo lo demás: ver, abrir archivos, adjuntar XML faltante y **capturar** la factura desde CxP (bandeja "Por capturar" / buzón de entrantes).

## Detalles técnicos

Base de datos (una migración):
- `bbva_movimientos`: reemplazar las políticas `Tesoreria write bbva_movimientos` (INSERT) y `Tesoreria update bbva_movimientos` (UPDATE) por versiones que acepten `has_role(auth.uid(),'tesorero')` **o** `has_role(auth.uid(),'contador')`. Por la jerarquía de roles (`roles_jerarquia`), `'contador'` ya cubre `auxiliar_contable`.
- `embarque_facturas_entrantes`: recrear la política INSERT `Operaciones sube facturas entrantes` sin la rama `has_role(...,'contador')` (esto excluye contador y auxiliar contable); se conservan `subido_por = auth.uid()`, `estado = 'por_capturar'` y el guard de organización.
- Verificación posterior con el linter de la base y una prueba SQL de roles (contador inserta movimiento bancario = OK; contador inserta factura entrante = 42501).

Frontend:
- `src/lib/access/permissionMatrix.ts`: agregar `contador` y `auxiliar_contable` a `CAPTURAR_MOVIMIENTO_BANCARIO`; nueva capacidad `SUBIR_FACTURA_ENTRANTE_EMBARQUE` (super_admin, admin_org, admin, operador, coordinador_logistico, gerente_operaciones).
- `src/hooks/shared/usePermissions.ts`: exponer `canSubirFacturaEntranteEmbarque`.
- `src/features/embarques/components/TabFacturasEntrantes.tsx`: `puedeSubir` pasa a usar la nueva capacidad en lugar de `canCapturarFacturaProveedor`, con mensaje explicativo cuando no aplica.
- Tesorería (`ConciliacionToolbar.tsx`, `PanelConciliacionMovimiento.tsx`): sin cambios de código, heredan la matriz ampliada.

Pruebas:
- Actualizar `usePermissions.test.tsx` y `ConciliacionToolbar.permisos.test.tsx` (contador ahora sí ve captura/importar).
- Nueva prueba de `TabFacturasEntrantes` (contador no ve "Subir factura"; operador sí).
- Suite SQL de roles para las dos políticas.

Documentación: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.
