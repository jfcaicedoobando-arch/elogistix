# Alta provisional de agentes desde Nueva tarifa

## Qué vas a ver
1. **En Nueva tarifa**, junto al campo Agente, una opción **"+ Agente provisional"**. Abre un formulario corto: Nombre, País, Contacto y correo (opcional). Al guardar, el agente queda elegido en la tarifa y aparece con la etiqueta **"Provisional"**.
2. **En Proveedores**, un filtro **"Provisionales por aprobar"** y un aviso con cuántos hay.
3. **El contador** (y administradores) ve el botón **"Aprobar como proveedor"**. Abre el formulario completo del proveedor para llenar lo que falta (RFC/Tax ID, régimen fiscal, dirección, datos bancarios, días de crédito, moneda). Sólo cuando están completos los datos obligatorios se puede aprobar; entonces la etiqueta cambia a proveedor normal.
4. Si no se trabaja con el agente, el contador puede **descartarlo** (se archiva, no se borra; sus tarifas quedan como histórico).

## Reglas
- Un agente provisional **sí** sirve para capturar tarifas y responder pricing.
- Mientras sea provisional **no** se le pueden registrar facturas de proveedor ni pagos (aviso: "Este proveedor está pendiente de aprobación por Contabilidad").
- Quién crea provisionales: quienes hoy pueden capturar tarifas. Quién aprueba: contador y administrador.
- Los proveedores existentes quedan como aprobados; nada cambia para ellos.

## Detalles técnicos
- Migración aditiva en `proveedores`: `estado_alta text NOT NULL DEFAULT 'aprobado' CHECK (estado_alta IN ('provisional','aprobado'))`, `aprobado_por uuid`, `aprobado_at timestamptz`.
- RPC `crear_agente_provisional(nombre, pais, contacto, email)` SECURITY INVOKER, atómica: crea `proveedores` (tipo Agente de Carga, provisional) + `costeo_agentes` ligado, misma org; idempotente por nombre normalizado en la org.
- RPC `aprobar_proveedor_provisional(id, datos)`: valida rol contador/admin con `has_role`/membresía, misma org, campos obligatorios completos; registra en bitácora.
- Trigger en `proveedor_facturas` y `pagos_proveedor` que rechaza proveedores provisionales.
- Frontend: `AgenteProvisionalDialog.tsx` (FormDialogShell) en `TarifaFormFields`; badge y filtro en Proveedores; capacidad `canAprobarProveedor` en usePermissions con prueba.
- Pruebas focalizadas (permisos, validación de obligatorios, bloqueo de facturas) + `db:postcheck`; CI/RLS completos en GitHub Actions. Sin cambio de versión salvo autorización.
