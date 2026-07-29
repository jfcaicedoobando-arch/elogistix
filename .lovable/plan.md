
## Sí, se puede — y ya tenemos casi todas las piezas

Hoy el tipo de cambio DOF se consulta **en vivo** a Banxico cada vez que alguien lo necesita (edge function `exchange-rates`, series SF43718 USD y SF46410 EUR, con caché en memoria de 12 h). Si Banxico se cae, la app muestra error y no hay historial guardado.

También ya existe un cron diario en la base (`marcar_facturas_vencidas_diario`, 6:00 AM), así que la infraestructura de `pg_cron` + `pg_net` está probada.

Analogía: hoy le hablamos al banco por teléfono cada vez que queremos saber el precio del dólar. Lo que propongo es que un asistente llame una vez al día, lo anote en una libreta nuestra, y que todos consulten la libreta.

## Qué se va a construir

**1. Tabla interna `tipos_cambio_dof`**
- Un renglón por día: fecha DOF, USD→MXN, EUR→MXN, fuente (`banxico_sie`), y de dónde vino (automático o manual).
- Catálogo global (no por cliente): todos los usuarios autenticados pueden leerla; sólo el proceso automático puede escribir.

**2. Edge function `tc-dof-diario`**
- Reutiliza la lógica ya probada de `exchange-rates` (misma selección de "Publicación DOF vigente").
- Guarda/actualiza el renglón del día. Si Banxico no responde, **no guarda nada** (nunca inventa un valor) y deja el error en los logs.
- Incluye modo *backfill* para llenar de golpe los últimos 30 días al arrancar.

**3. Cronjob diario**
- Todos los días a las **7:00 AM hora CDMX** (después de que el DOF ya publicó).
- Llama a la edge function. Si falla, reintento automático a las 10:00 AM (el guardado es idempotente: escribir dos veces el mismo día no duplica).

**4. La app lee primero de la tabla**
- `exchange-rates` consulta la tabla antes de llamar a Banxico; sólo llama a Banxico si el día no está registrado.
- Beneficios: respuestas instantáneas, no se agota la cuota del token de Banxico, y queda historial auditable (puedes justificar ante el SAT qué TC se usó cada día).
- El comportamiento visible no cambia: los flujos fiscales siguen rechazando valores de fallback.

**5. Pantalla de consulta (opcional, incluida)**
- Tabla simple en Configuración → catálogos con el historial de TC DOF y botón "Actualizar ahora" para admins, por si el cron falló un día.

## Detalle técnico

- Tabla `public.tipos_cambio_dof`: `fecha date PK`, `usd_mxn numeric(12,4)`, `eur_mxn numeric(12,4)`, `fuente text`, `origen text` (`cron` | `manual`), `created_at`/`updated_at` + trigger. GRANT `SELECT` a `authenticated`, `ALL` a `service_role`; RLS con política de lectura para autenticados y escritura sólo service_role.
- Extracción de la lógica compartida de `supabase/functions/exchange-rates/index.ts` a `supabase/functions/_shared/banxicoDof.ts` para no duplicar (`extraerPublicacionDof`, `rangoUltimosDias`, etc.), conservando los tests actuales.
- Cron con `cron.schedule` + `net.http_post` creado vía la herramienta de datos (no migración), porque el SQL lleva la URL y la anon key del proyecto.
- RPC `tc_dof_vigente(_fecha date default current_date)` `SECURITY DEFINER` con `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO authenticated` (regla H6 del auditor de migraciones).
- Tests: unitarios del upsert/backfill (Deno) y del servicio/hook nuevo; nada rompe el contrato `{ usdMxn, eurMxn }`.
- `CHANGELOG.md` + bump de `APP_VERSION`.
