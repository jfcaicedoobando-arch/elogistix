## Contexto

El scanner marcó dos policies `USING/WITH CHECK (true)` en escrituras:

1. **`cotizacion_costos_historico`** — policy `ALL` restringida a `service_role`. `service_role` bypassea RLS por definición, así que `true` es inocuo. **Falso positivo**: se marca como *ignore* con explicación.

2. **`demo_leads`** — policy `INSERT` a `anon, authenticated` con `WITH CHECK (true)`. Es el formulario público de captura de leads, así que el `INSERT` anónimo es intencional, pero podemos **endurecer el `WITH CHECK`** con validación básica de payload para reducir spam/abuso y quitar el `true` desnudo.

## Cambios

### 1. Migración `demo_leads`
Reemplazar la policy `"Anyone can insert demo leads"` por una versión con validación:

```text
WITH CHECK (
  nombre IS NOT NULL AND length(btrim(nombre))    BETWEEN 2 AND 120
  AND empresa IS NOT NULL AND length(btrim(empresa)) BETWEEN 2 AND 160
  AND email IS NOT NULL AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 200
  AND telefono_e164 IS NOT NULL AND telefono_e164 ~ '^\+[1-9][0-9]{6,14}$'
  AND (user_agent IS NULL OR length(user_agent) <= 500)
)
```

Esto valida en la BD lo mismo que ya se manda desde el cliente (`createDemoLead`), sin cambiar la API pública ni romper el flujo actual.

### 2. Ignorar el hallazgo de `cotizacion_costos_historico`
Marcar como *ignore* vía `manage_security_finding` con la razón: policy alcanzada sólo por `service_role`, que ya bypassea RLS; el `true` no otorga acceso adicional a `anon`/`authenticated`.

### 3. Marcar el hallazgo de `demo_leads` como *fixed* tras la migración.

### 4. Versionado
- `APP_VERSION` → `13.300.54`
- Entrada en `CHANGELOG.md` describiendo el endurecimiento de la policy.

## Notas técnicas
- No hay cambio de frontend: `createDemoLead` ya envía los campos con formato E.164 y email válido.
- No se toca la policy del historial de cotizaciones; sólo se documenta como ignorado en el scanner.
