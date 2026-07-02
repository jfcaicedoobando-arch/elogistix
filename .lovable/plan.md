## Objetivo

En el modal "Enviar proforma al cliente", los campos **Para** y **CC** deben "recordar" los correos ya usados con ese cliente, de forma que:

1. Se **pre-rellenen** con los destinatarios del último envío hecho a ese mismo cliente.
2. Al escribir, aparezca un **autocompletado** con todos los correos previamente usados (envíos anteriores + contactos guardados del cliente).

Sólo cambia UI/frontend del modal `EnviarProformaDialog`. No se altera el envío ni la edge function.

## Analogía

Piensa en el campo "Para" de Gmail: cuando empiezas a escribir un correo, te sugiere los que ya usaste antes con esa persona. Aquí hacemos lo mismo, pero acotado por cliente.

## Fuentes de la "memoria"

Para el `cliente_id` de la proforma abierta, se combinan (y deduplican, en minúsculas):

- `proforma_envios.destinatarios` y `proforma_envios.cc` de las proformas de ese cliente, ordenados por `created_at desc` (últimos 20 envíos).
- `contactos_cliente.email` del cliente (contactos guardados).

El **último envío** (el más reciente) se usa además para prefill inicial de "Para" y "CC" cuando se abre el modal, siempre que los campos estén vacíos. El usuario puede borrar/editar libremente.

## Cambios técnicos

1. **Nuevo hook** `useDestinatariosSugeridos(clienteId)` en `src/features/proformas/hooks/useDestinatariosSugeridos.ts`:
   - React Query, `staleTime: 60_000`.
   - Query 1: `proforma_envios` filtrado por `cliente_id` (vía join a `proformas`), `select('destinatarios, cc, created_at')`, `order created_at desc`, `limit 20`.
   - Query 2: `contactos_cliente` filtrado por `cliente_id` y `deleted_at is null`, `select('email')`.
   - Devuelve `{ sugerencias: string[], ultimo: { to: string[]; cc: string[] } | null }`.
   - Normaliza a lowercase y trim para deduplicar.

2. **`EnviarProformaDialog.tsx`**:
   - Consumir el hook con `proforma.cliente_id`.
   - En el `useEffect` de apertura: si `destinatarios` está vacío y hay `ultimo`, prefill "Para" y "CC" con los strings separados por `, `.
   - Añadir `<datalist id="proforma-emails-sugeridos">` con las `sugerencias` y enlazar los `<Input>` de "Para" y "CC" con `list="proforma-emails-sugeridos"`.
   - Como los inputs contienen listas separadas por coma, el `datalist` nativo autocompleta la última palabra escrita — comportamiento aceptable y sin dependencias nuevas.
   - Debajo del campo "Para", mostrar un pequeño hint tipo `Últimos usados: cliente@x.com, contabilidad@x.com` (máx. 3), clicables para agregar al campo si no están ya presentes.

3. **Sin cambios de BD**: `proforma_envios` ya guarda `destinatarios` y `cc`; RLS ya permite lecturas por `organization_id`.

## Detalles técnicos

- Extracción robusta del email desde `destinatarios` (jsonb): soporta tanto `[{ email: "..." }]` (formato actual) como strings sueltos por si hay legacy.
- Validación de email simple con regex antes de agregar al hint clicable, para no ofrecer basura.
- El prefill sólo ocurre en la apertura y sólo si los campos están vacíos, para no pisar edición del usuario.
- Se respeta la regla Power of 10: componente sigue ≤200 líneas — el hook se aísla en su propio archivo.
- Tipos: `ProformaEnvioDestinatario = { email: string; nombre?: string }`, sin `any`, con `// SAFE-CAST:` sólo si es necesario para castear el `jsonb`.

## Bitácora

- Bump `APP_VERSION` a `13.145.1`.
- Entrada en `CHANGELOG.md`: "Modal de envío de proforma recuerda correos previamente usados por cliente (prefill + autocompletado)".

## Fuera de alcance

- No se crea un editor de contactos ni se marcan contactos como "de facturación".
- No se agrega un combobox/chips avanzado (queda propuesto como mejora futura si se quiere UX tipo Gmail con tags).
