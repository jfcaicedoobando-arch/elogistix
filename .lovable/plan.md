# Fix: envío de CFDI a destinatario equivocado desde "Por enviar"

## Qué pasó (analogía)
Hoy el botón **Enviar** de la tabla "Por enviar" funciona como un sobre pre-dirigido que se manda solo al presionar. La dirección la pone la edge function `facturapi-enviar-email`, que toma **el contacto más antiguo del cliente que tenga email** (`contactos_cliente` ordenado por `created_at` ASC). Si el contacto más viejo es "logística" u "operaciones" y no "facturación/pagos", la factura sale al buzón equivocado — y el usuario nunca vio a dónde iba.

Diagnóstico **no confirmado con datos de la factura específica** (no me diste el folio); lo que sí está confirmado leyendo el código es que:
- `BandejaPorEnviar.tsx` dispara `enviarCfdiFactura(id)` sin pedir confirmación ni mostrar el email destino.
- `resolveEmail()` en la edge function usa `order created_at asc limit 1` sobre `contactos_cliente`, sin distinguir tipo de contacto.
- `contactos_cliente.tipo` existe pero hoy no se usa para elegir destinatario.

## Objetivo
Que sea **imposible** mandar un CFDI a la persona equivocada sin darse cuenta desde esta bandeja, y mejorar la heurística de "a quién le corresponde".

## Cambios propuestos

### 1. Confirmación con destinatario visible (frontend)
- Reemplazar el botón que dispara inmediato en `BandejaPorEnviar.tsx` por un pequeño diálogo (`ConfirmarEnvioCfdiDialog`) que:
  - Muestra folio, cliente y **email sugerido** (lo obtiene con una consulta ligera al abrir).
  - Permite **editar el email** antes de confirmar (mismo campo `email` que ya acepta la edge).
  - Muestra la lista de contactos del cliente con email para elegir con un clic.
  - Botón **Enviar** solo se activa con email válido.
- Reusar este diálogo en cualquier otro lugar del detalle de factura que dispare `enviarCfdiFactura` sin confirmación (auditar 1–2 call sites).

### 2. Mejor heurística en `resolveEmail` (edge function)
Nuevo orden de preferencia dentro de `contactos_cliente` del cliente:
1. `tipo` que empate con roles de cobranza/facturación (ej. `Facturación`, `Cobranza`, `Contabilidad`, `Pagador`) — orden por `created_at` DESC (el más reciente gana).
2. Cualquier otro contacto con email — orden por `created_at` DESC (antes era ASC, que es lo peor porque congela al contacto original aunque haya cambiado).
3. Fallback a `clientes.email`.

Nota: hoy `contactos_cliente.tipo` está poblado con valores tipo "Exportador"; el matching será *tolerante* (case-insensitive, incluye variantes) y si nada empata, seguimos al paso 2. No rompe datos existentes.

### 3. Registro en bitácora del "email sugerido vs enviado"
Ampliar el `detalles` del evento `cfdi_enviado` para guardar `email_sugerido`, `email_enviado` y `override_manual: boolean`. Sirve para auditar futuros incidentes similares.

### 4. Post-mortem del envío reportado
Consultar `bitacora_actividad` filtrando `accion = 'cfdi_enviado'` recientes del usuario para identificar el folio afectado y avisarle al cliente correcto (no automatizable — te reporto qué encontramos).

## Fuera de alcance
- No se toca el flujo masivo/reenvío desde el detalle de factura, ni el envío de REP/NC (mismos servicios pero fuera de la bandeja "Por enviar").
- No se agrega un campo nuevo "contacto de facturación" en el schema (usa `tipo` existente).

## Detalles técnicos
- Archivos a editar:
  - `src/features/facturacion/components/bandejas/BandejaPorEnviar.tsx` — quitar `EnviarButton` inline, abrir diálogo.
  - Nuevo `src/features/facturacion/components/dialogs/ConfirmarEnvioCfdiDialog.tsx`.
  - Nuevo hook `useContactosClienteParaEnvio.ts` (consulta `contactos_cliente` + `clientes.email`).
  - `supabase/functions/facturapi-enviar-email/index.ts` — refactor `resolveEmail` + bitácora enriquecida.
- Deploy: `supabase--deploy_edge_functions(["facturapi-enviar-email"])`.
- Version bump: `APP_VERSION` a `13.315.1` y entrada nueva en `CHANGELOG.md`.
- Tests: unit del nuevo diálogo (email válido habilita botón, editar override, fallback correcto) y un test del hook con Supabase mockeado.

## Verificación
- `bun run lint -- --max-warnings 0`
- `bun run typecheck`
- Test unitario del nuevo diálogo.
- Deploy y prueba manual: abrir "Por enviar", clic en **Enviar**, verificar que aparezca el email antes de mandar y que se pueda cambiar.
