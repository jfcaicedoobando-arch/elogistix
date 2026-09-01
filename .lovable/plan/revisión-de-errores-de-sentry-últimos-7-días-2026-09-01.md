# Revisión de errores de Sentry (últimos 7 días)

Hay 7 issues sin resolver. La mayoría ya están corregidos en código o no son bugs de la app. Sólo uno amerita un cambio real, y es pequeño.

## Triage

| Issue | Error | Diagnóstico | Acción |
|---|---|---|---|
| JAVASCRIPT-REACT-5S | `LC_CONFLICTO_CONCURRENCIA` en `/cotizaciones/nueva` | Ya corregido en v13.823.15 (sello de concurrencia se siembra al crear) | Marcar `resolved` |
| JAVASCRIPT-REACT-5R | "Requiere un rol con permiso de captura CxP" | Ya corregido y desplegado en v13.823.14 (`coordinador_logistico` autorizado) | Marcar `resolved` |
| JAVASCRIPT-REACT-5Q | `FacturapiError: no respondió en 30000 ms (invoices.cancel)` | Timeout externo de FacturApi; el manejo ya existe desde v13.821.6 | Marcar `resolved` (sin código) |
| JAVASCRIPT-REACT-5T | "El servicio de captura por IA no está disponible" | Causa raíz real: `FunctionsFetchError: Failed to fetch` desde una tablet Android (red del usuario). La función `parse-invoice-pdf` existe y el flujo ya reintenta y ofrece captura manual | Sin código; ajustar mensaje (ver abajo) |
| LIFTGO-1 | `TypeError: ... reading 'default'` | Pertenece a otra app (`release: liftgo@7.412.0`, `tenant: liftgo`), no a Libre Carga | Ignorar (no es de este proyecto) |
| JAVASCRIPT-REACT-5P y 5N | `Error: unknown error` en `/embarques/:id` | Mismo evento duplicado (una traza): la consulta `embarques → dependencias-financieras` falló con un error **sin mensaje** (`message: ""`), en release vieja 13.792.0. La causa exacta no está confirmada; el patrón (mensaje vacío, `handled: yes`, misma traza) es típico de petición cortada/red, no de un error de SQL | Corrección mínima de diagnóstico (ver abajo) |

## Corrección mínima propuesta (YAGNI)

Un solo cambio de calidad de diagnóstico y mensajes, sin features nuevas:

1. Cuando un error de Supabase llegue **sin mensaje**, dejar de reportarlo como `unknown error`: clasificarlo como fallo de red/petición cancelada usando el estado de conexión (`navigator.onLine`) y el código HTTP disponible, y mostrar al usuario "Revisa tu conexión e intenta de nuevo" en lugar de un texto técnico vacío. Esto agrupa correctamente estos eventos en Sentry y evita duplicados como 5P/5N.
2. En el mismo helper de errores, incluir la tabla/consulta afectada en el título del evento, para que un próximo caso llegue accionable en vez de "unknown error".
3. En la captura por IA de PDF (`parse-invoice-pdf`), diferenciar el mensaje cuando la falla es de red del dispositivo (`Failed to fetch`) del caso en que el servicio realmente responde con error, para que el usuario en móvil sepa que es su conexión.

## Detalles técnicos

- Archivos a tocar: el normalizador de errores compartido usado por `ui_notify`/react-query (el que produce el string `unknown error`) y `src/features/cxp/services/parsePdfInvoice.ts`.
- No hay cambios de base de datos, ni RPC, ni migraciones, ni Edge Functions nuevas.
- Pruebas: casos unitarios para error con `message: ""` (offline y online) y para `FunctionsFetchError` en el flujo de PDF IA.
- Cierre: bump de `APP_VERSION` + entrada en `CHANGELOG.md` referenciando los issueIds, y marcar en Sentry como `resolved` 5S, 5R, 5Q, 5T y 5P/5N.
