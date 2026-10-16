# Demo HTTP deshabilitado: entrega saneada

Base de integración: `a58228ae4c696c542b8042010de8b5abfda97d8c`.

El adaptador no conecta proveedor de disponibilidad ni configuración de
credenciales. OPTIONS mantiene su respuesta y CORS público compartido. Las
demás solicitudes devuelven 503 `{"error":"demo_unavailable"}`, Retry-After 30
y Cache-Control no-store antes de construir clientes, usar Auth o ejecutar RPC.
El request no puede aportar disponibilidad, identidad ni credenciales.

El contrato de disponibilidad sigue aceptando sólo la decisión interna exacta
`{available:true,state:"active"}`. Incluso con esa decisión, la falta de
configuración interna de credenciales mantiene el mismo cierre 503. Los campos
vacíos o de sólo espacios también se rechazan antes de cualquier efecto. Esta
release no proporciona esa configuración y una futura habilitación requiere
una revisión independiente.

Los flujos existentes de límites, Auth, membresía y seed se conservan detrás de
ambos cierres y no se ejecutan en esta release. No se cambia, resetea ni revoca
la cuenta real. No se incluyen valores reales de cuenta en código, pruebas,
documentación ni artefactos de entrega.

Las pruebas usan identificadores aleatorios de un dominio reservado y valores
aleatorios generados durante la ejecución. Verifican ausencia de clientes,
Auth/RPC y cierres de sesión en cada rama cerrada, solicitudes hostiles,
preflight, CORS, espera asíncrona y compatibilidad del flujo sintético positivo.

La validación requiere Deno 2.9.7 con los imports originales de Supabase y
Sentry 11.4.0. Los tests ejecutan typecheck y niegan red/entorno en runtime.
Se entregan archivos finales completos, tamaños, SHA256 y evidencia saneada;
no se entrega un diff con contexto histórico.
