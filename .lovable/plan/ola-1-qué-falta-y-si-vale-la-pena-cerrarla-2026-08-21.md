# Ola 1 — Qué falta y si vale la pena cerrarla

Revisé el documento contra el estado real de la base y del código. La mayor parte de la Ola 1 ya quedó aplicada en la versión 13.707.0. Lo que falta son cuatro cosas de fondo y unos detalles visuales.

## Ya está hecho (verificado)

- O1.1 a O1.5: las funciones de reversión de proformas, limpieza de cancelaciones, comisiones pendientes, tipo de cambio DOF y archivado de versiones ya validan organización/rol (y el DOF quedó sólo para super admin, con bitácora).
- O1.6 y O1.7: los pagos programados ya envían llave por captura y el aviso de "ya se registró" tiene mensaje claro.
- O1.8, O1.9, O1.13: notas de crédito convertidas a la moneda de la factura, candados en orden fijo en los lotes y tolerancia unificada en medio centavo.
- O1.10: el periodo de liquidación ya usa hora de Ciudad de México.
- O1.12 (parcial): la base ya rechaza cobros con fecha futura.
- O1.14: no quedan tablas de la lista sin sello de "última modificación".
- O1.UI: el botón de la barra lateral ya tiene etiqueta accesible.

## Lo que falta

### 1. Red de seguridad: pruebas de regresión (recomendado, es lo que más vale)
Los candados existen pero nadie vigila que no se caigan en el futuro. Falta escribir:
- Pruebas cruzadas entre organizaciones para las cinco funciones endurecidas (usuario de otra organización debe recibir "no autorizado"; el propio debe poder).
- Prueba de factura en dólares con nota de crédito en pesos: el cobro correcto debe pasar y el sobrepago real debe rechazarse.
- Prueba de cobro con fecha futura y de tolerancia (0.004 pasa, 0.006 no).
- Prueba del catálogo de mensajes para el aviso de doble envío.

Analogía: ya pusimos las chapas en las puertas; esto es instalar la alarma que suena si alguien las quita.

### 2. O1.11 — Doble avance de estado de embarque
Hoy cada intento de avanzar el estado genera una llave nueva, así que si la red se cae y el usuario reintenta, la transición puede registrarse dos veces (con evento y bitácora duplicados). Falta usar la llave estable ya existente en el proyecto, igual que en el alta de embarques.

### 3. O1.15 — Límites de archivos en los almacenes
Los siete buckets no tienen ni límite de tamaño ni lista de tipos permitidos: hoy alguien puede subir un archivo enorme o de cualquier tipo. Falta fijar 20 MB y permitir sólo PDF, XML, JPG y PNG, alineando el límite con el lector de facturas XML.

### 4. O1.16 — Validar reglas históricas (11 restricciones)
Hay 11 reglas de integridad marcadas como "no validadas": aplican a datos nuevos pero nunca se revisó el histórico. Falta un reporte que liste qué filas antiguas las violan; sólo si sale limpio se activan de verdad. Es lectura primero, sin riesgo.

### 5. Detalles visuales pendientes (O1.UI)
- "Presupuesto (conceptos_costo)" en Conciliación de compras: mostrar el nombre en español, sin el nombre técnico de la tabla.
- Un solo nombre canónico para el diálogo de borrado con doble confirmación (hoy hay alias duplicado).
- Títulos de pestaña por ruta (Nueva cotización, Proformas, Comisiones, Profit).
- Columna NETO cortada en el panel de flujo esperado de Tesorería.
- Encabezado "Vence en" partido en Facturación.
- Tarjeta "Aplicado a facturas" en Anticipos: no pintar de verde cuando el valor es cero.

## ¿Vale la pena terminarla?

Sí, pero por partes. Mi recomendación de orden:

1. Pruebas de regresión (punto 1) y el doble avance de embarque (punto 2): valor alto, riesgo bajo.
2. Límites de archivos (punto 3): valor alto, un cambio de configuración.
3. Reporte de reglas históricas (punto 4): sólo lectura ahora; activar después en ventana de mantenimiento.
4. Detalles visuales (punto 5): commit aparte, sin tocar lógica.

Lo que dejaría documentado como riesgo aceptado (no bloquea el release): si el negocio quiere tipo de cambio manual por organización, eso es decisión de producto y hoy el catálogo es global a propósito.

## Detalles técnicos

- Pruebas SQL nuevas en `supabase/tests/` (y casos en `supabase/tests/rls/test_rls_cross_tenant_mutations.sql`), con los prefijos `LC_` ya registrados.
- O1.11: usar `useStableRequestId` de `src/lib/idempotency.ts` en `useEmbarqueEstadoActions.ts` / `useEmbarqueReabrirCancelar.ts` y quitar el `requestId ?? newRequestId()` de `useAvanzarEstadoEmbarque`, para que el reintento reuse la llave y sólo se renueve tras éxito.
- O1.15: `UPDATE storage.buckets SET file_size_limit / allowed_mime_types` por bucket (PDF/XML para `cxp-inbox` y `facturas`; imágenes sólo donde aplique), revisando el límite de la función `parse-cfdi-xml`.
- O1.16: script de reporte por cada una de las 11 restricciones `NOT VALID`, alimentando el módulo de Auditoría; `VALIDATE CONSTRAINT` sólo si el reporte sale en cero.
- Todo cierra con `APP_VERSION` + entrada en `CHANGELOG.md`.
