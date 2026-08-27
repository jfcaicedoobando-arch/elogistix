# Cerrar el alta de clientes desde el CRM

## Qué pasó (en corto)

El CRM no maneja los clientes "por separado", pero la conversión de lead tenía una puerta trasera. Es como si el módulo de Clientes tuviera torniquete con guardia (rol autorizado, RFC, CP, régimen fiscal, checklist de documentos) y el botón "Convertir lead" fuera una puerta de servicio sin guardia: crea el cliente con privilegios elevados y con los campos del lead, que casi siempre vienen vacíos.

Verificado en la base de datos:

- La función de conversión corre con privilegios elevados y está habilitada para cualquier usuario autenticado, así que se salta la regla que limita el alta de clientes a admin, admin_org, operador, contador y super_admin.
- Inserta el cliente con lo que traiga el lead: el lead IAASA tiene RFC, dirección y CP vacíos, así que el cliente IAASA nació sin RFC, sin CP, sin régimen fiscal ni uso de CFDI.
- La tabla de clientes no tiene RFC único, así que ese camino también puede generar clientes duplicados.

## Qué se va a hacer

1. **Quitar el alta de clientes desde el lead.** La conversión solo creará la oportunidad y podrá ligar un cliente **ya existente** del directorio. El alta de clientes vive únicamente en el módulo de Clientes, con su wizard y sus candados.
2. **Bloquearlo también en la base de datos**, no solo en la pantalla: si alguien llama la función pidiendo crear cliente, se rechaza con un error claro (`LC_LEAD_ALTA_CLIENTE_PROHIBIDA`) explicando que debe darse de alta en Clientes.
3. **Rediseñar el diálogo/hoja de conversión**: en lugar del checkbox "Crear cliente en el directorio", un buscador de cliente existente (opcional) más un enlace "Dar de alta cliente" que abre el flujo oficial. La oportunidad puede quedar sin cliente y ligarse después.
4. **Limpiar el caso IAASA**: eliminar lógicamente ese cliente, dejar la oportunidad sin cliente y volver a dar de alta IAASA por el flujo correcto (Clientes → Nuevo cliente / CSF). La oportunidad se religa al cliente nuevo.
5. **Pruebas de regresión**: la conversión con "crear cliente" debe fallar; convertir ligando cliente existente de otra organización debe fallar; convertir sin cliente debe funcionar y dejar la oportunidad ligada al lead.

## Detalles técnicos

- Migración nueva sobre `public.convertir_lead_rpc`: mantiene la firma actual (para no romper tipos generados), pero valida `IF COALESCE(p_crear_cliente,false) THEN RAISE EXCEPTION 'LC_LEAD_ALTA_CLIENTE_PROHIBIDA'`, elimina el bloque `INSERT INTO public.clientes` y conserva la validación de `p_cliente_id` (misma org, no borrado). Se mantienen `is_org_member`, idempotencia y el resto de la herencia (sector/origen/destino) intactos.
- Frontend:
  - `src/features/crm/services/leads/convertir.ts`: `crearCliente` deja de ser una opción efectiva; el parámetro se envía siempre en `false` y se marca deprecado.
  - `ConvertirLeadDialog.tsx` y `ConvertirLeadSheet.tsx`: se retira el checkbox y se agrega selector de cliente existente (usando `fetchClientesForSelect`, que ya filtra `deleted_at IS NULL`) más enlace al alta oficial.
  - Mensaje en español para `LC_LEAD_ALTA_CLIENTE_PROHIBIDA` en el catálogo de errores.
- Datos: `UPDATE clientes SET deleted_at = now()` para IAASA y `UPDATE crm_oportunidades SET cliente_id = NULL, cliente_nombre = ''` en la oportunidad afectada (vía `run_sql`, respetando el candado de papelera).
- Tests: `src/features/crm/services/leads/__tests__/convertir.test.ts` y suite SQL en `supabase/tests/` para los tres escenarios.
- Cierre: sincronizar `supabase/schema/baseline.sql`, espejos canónicos y manifiesto; `CHANGELOG.md` + bump de `APP_VERSION`.

## Fuera de alcance

No se amplían los roles con permiso de alta de clientes: siguen siendo admin, admin_org, operador, contador y super_admin.
