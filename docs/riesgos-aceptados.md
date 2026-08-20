# Riesgos aceptados

Registro de riesgos conocidos que se decidieron aceptar (con su mitigación), para
que una auditoría futura no los reporte como hallazgos nuevos.

## RN-EC-4 · Rate limit por IP con `x-forwarded-for` (Ola 5, 2026-08)

**Riesgo.** Las Edge Functions derivan la identidad del cliente de la cabecera
`x-forwarded-for` para el bucket de rate limit (`ratelimit_buckets`). Esa
cabecera es falsificable por el llamador, así que un atacante puede rotar el
valor y obtener una cuota nueva por cada IP inventada.

**Por qué se acepta.**

- Existe además un tope **global** por función (no por IP), que acota el abuso
  agregado independientemente de la cabecera.
- Las funciones sensibles exigen sesión autenticada y validan tenant
  (`organization_id`), por lo que el rate limit por IP es defensa en profundidad,
  no el control principal.
- La alternativa (rate limit por `user_id` + tope global) ya está aplicada en las
  funciones de escritura financiera.

**Cuándo revisar.** Si se expone alguna función sin autenticación al público
(formularios web, tracking anónimo), ese endpoint debe pasar a un rate limit con
identidad no falsificable (token firmado o captcha) antes de publicarse.

## V-14 · `formatFechaEs` sigue en 56 call-sites

Deprecado, congelado por ratchet (`formatfechaes-deprecado.test.ts`). Migración
progresiva a `formatFechaDia`; no bloquea release porque el comportamiento de
zona horaria ya es correcto (ancla a mediodía UTC).

## RN-1 · Topes de ratchet con holgura de 10

Los ratchets de deuda (iconos `h-4 w-4`, `toFixed`, `uppercase`, `select("*")`,
`formatFechaEs`) usan `DEUDA_CONGELADA + 10`. Se acepta que la deuda pueda
crecer hasta 10 usos entre limpiezas para no romper CI en PRs no relacionados;
el plan es bajar el tope cada trimestre.
