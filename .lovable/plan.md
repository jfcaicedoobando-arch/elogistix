## Objetivo

En el modal **Enviar proforma**, permitir borrar correos de la lista "Recientes" para que no vuelvan a aparecer como sugerencia cuando ya no se usan.

## Alcance

- Sólo afecta la UI del modal y su lista de sugerencias.
- No borra registros históricos (`proforma_envios` sigue intacto para auditoría) — sólo oculta los correos que el usuario decida descartar.
- El descarte es **por cliente** y persistente para ese usuario/navegador.

## Comportamiento propuesto

1. Cada chip "Recientes" muestra una pequeña **✕** al hacer hover (o siempre visible en móvil).
2. Al hacer clic en la ✕:
   - Se agrega ese correo a una lista de "ocultos" para ese cliente.
   - El chip desaparece con feedback (toast: *"Correo ocultado. Deshacer"* con acción para revertir).
3. El correo tampoco aparecerá en el autocompletado (`<datalist>`) mientras esté oculto.
4. Si el usuario escribe manualmente el correo y envía la proforma, vuelve a aparecer como sugerencia (el envío "reactiva" el correo).
5. Enlace pequeño *"Restaurar ocultos (N)"* debajo de los chips cuando haya correos ocultos, para revertir todos de una vez.

## Implementación técnica

- **Persistencia**: usar el wrapper permitido `browserStorage` (`mem://technical/browser-storage`) con clave `proformas:emails-ocultos:{clienteId}` → `string[]` en minúsculas.
- **Hook nuevo** `useEmailsOcultos(clienteId)` con API: `{ ocultos, ocultar(email), restaurar(email), restaurarTodos() }`. Estado local sincronizado con storage.
- **Modificar** `useDestinatariosSugeridos.ts`: aceptar `ocultos: string[]` opcional y filtrar `sugerencias` (y opcionalmente `ultimo.to`/`ultimo.cc` sólo para prefill, decisión: **no** filtrar el prefill del último envío, únicamente los chips y autocomplete, para que el usuario vea qué se envió la última vez).
- **UI en** `EnviarProformaDialog.tsx`:
  - Chip con botón ✕ (usar componente existente `Badge` + `<button>` accesible con `aria-label="Ocultar {email}"`).
  - Toast con `notify` incluyendo acción "Deshacer".
  - Enlace "Restaurar ocultos".
- **Reactivación al enviar**: después de un envío exitoso, quitar de `ocultos` los correos incluidos en `to`/`cc` de ese envío.

## Archivos afectados

- `src/features/proformas/hooks/useEmailsOcultos.ts` (nuevo).
- `src/features/proformas/hooks/useDestinatariosSugeridos.ts` (filtrar por ocultos).
- `src/features/proformas/components/EnviarProformaDialog.tsx` (chips con ✕, toast deshacer, enlace restaurar, reactivación tras envío).
- `CHANGELOG.md` + `src/constants/appVersion.ts` (bump a `13.145.2`).

## Fuera de alcance

- No se crea tabla en base de datos; el ocultado es por usuario/navegador. Si más adelante se quiere compartir entre dispositivos, se puede migrar a una tabla `proforma_emails_ocultos` sin cambiar la UI.
