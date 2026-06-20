## Diagnóstico

**Analogía:** la función `enviar-cotizacion-email` toca el timbre de `send-transactional-email` y le entrega la "llave maestra" (service role key). El portero (validación JWT) está intentando descifrar la llave consultando un servicio externo y no le funciona, así que devuelve **Forbidden** para todos los destinatarios.

Evidencia en `cotizacion_envios`:

```
estado: "fallido"
error: [{ "email": "...", "ok": false, "error": "Forbidden" }, ... ]
```

El 403 viene de `supabase/functions/send-transactional-email/index.ts` en `verifyServiceRoleOrFail`:

```ts
const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
if (claimsError || claimsData?.claims?.role !== 'service_role') {
  return corsResponse({ error: 'Forbidden' }, 403)
}
```

`auth.getClaims()` valida JWTs con la clave pública asimétrica del proyecto. Cuando recibe el JWT estático del **service role** (HMAC, no asimétrico) en muchos proyectos Lovable Cloud no logra validarlo localmente y la verificación falla → todos los correos caen como `Forbidden`. El bug se introdujo con la versión actual de la validación; los logs de la edge function ni siquiera muestran el send porque rebota en el guard.

## Cambio propuesto (1 archivo)

`supabase/functions/send-transactional-email/index.ts` — reemplazar el `getClaims` por una comparación directa contra `SUPABASE_SERVICE_ROLE_KEY` (función llamada exclusivamente server-to-server por otras edge functions, no por el browser):

```ts
async function verifyServiceRoleOrFail(req: Request, env: EnvVars): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return corsResponse({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (token !== env.supabaseServiceKey) {
    return corsResponse({ error: 'Forbidden' }, 403)
  }
  return null
}
```

Por qué es seguro:
- El service role key sólo está accesible dentro de edge functions (no se expone al cliente).
- Una comparación exacta es estrictamente más estricta que `claims.role === 'service_role'` (sólo acepta *ese* key, no cualquier JWT firmado con role service_role).
- Mantiene el mismo contrato externo: las funciones que ya llaman con `Bearer <SERVICE_ROLE_KEY>` siguen funcionando.

## Verificación

1. Probar reenviando la misma cotización; confirmar que `cotizacion_envios.estado = 'enviado'` y que los registros en `email_send_log` cambian a `pending` → `sent`.
2. Confirmar que `useEnviarCotizacionEmail` ya no dispara `notifyError`.

## Bitácora

- `CHANGELOG.md`: agregar entrada `13.73.1 — fix(cotizaciones/email)`.
- `APP_VERSION` → `13.73.1`.

## Fuera de alcance

- No se modifica `enviar-cotizacion-email/handlers.ts` ni el flujo de envío en el cliente.
- No se cambia la lógica de plantillas, suppression list ni cola pgmq.
- No se tocan otras edge functions con guardas similares (no hay reportes de fallo).
