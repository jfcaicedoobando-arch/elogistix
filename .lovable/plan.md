# Remate R201 cotizaciones → embarques

## Alcance
Cerrar únicamente los defectos pendientes de R201-COT-01, R201-COT-02 y R201-COT-06, conservar sin reescribir 03/04/05/07/08/09, y corregir los bloqueos concretos reportados por GitHub Actions.

## Cambios
1. **Costo de tarifa decidido (R201-COT-01)**
   - Marcar desde la siembra cada costo con origen de cotización y una identidad inequívoca del renglón fuente.
   - Aplicar Refrescar/Sustituir únicamente a esos renglones, con coincidencia segura por referencias de tarifa/recargo, cantidad, moneda y proveedor.
   - Rechazar equivalencias ausentes o ambiguas en Sustituir; no caer a la tarifa anterior ni tocar costos manuales.
   - Mantener prorrateo exacto por centavos, idempotencia, venta aceptada e históricos.

2. **Re-aprobación exacta y transaccional (R201-COT-02)**
   - Construir en backend un snapshot económico canónico y estable de los cambios; guardar ese snapshot al solicitar aprobación.
   - Validar la aprobación contra el snapshot completo autoritativo, no sólo contra el porcentaje máximo.
   - Revalidar dentro de la transacción al crear con `reaprobada_ventas`; una tarifa cambiada después de leer la pantalla volverá a bloquear.

3. **Importación recuperable (R201-COT-06)**
   - Exponer carga/error/reintento de costos vinculados, limpiar costos al recibir una respuesta válida vacía y avisar de forma contextual al fallar.
   - Bloquear avance/guardado mientras la importación esté pendiente o fallida.
   - Evitar que una respuesta tardía pise ediciones locales y conservar la restauración de borrador sin rehidratar.

4. **Empaquetado y Actions**
   - Corregir REVOKE/GRANT EXECUTE explícitos, catálogo `service_role-only`, excepción obsoleta de replay mirror y el cast HIGH real.
   - Sincronizar espejos SQL, migración pendiente y manifiesto; incrementar patch y CHANGELOG.
   - Escribir regresiones mínimas para SQL y hook, sin ejecutarlas localmente.

## Límites
- No publicar, aplicar migraciones, consultar/modificar datos, ni ejecutar tests, CI, RLS o suites locales.
- La migración R201 seguirá pendiente de despliegue; el estado de Actions se reportará según los runs existentes, sin declarar verde lo no reejecutado.
