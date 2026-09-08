# Quitar la carta "Oportunidades generadas" vacía en leads

Tienes razón en el flujo: **Lead → (calificar) → Prospecto → Oportunidad**. Un lead todavía no puede tener oportunidades; el botón "Nueva oportunidad" sólo aparece cuando ya es prospecto, y la carta "Oportunidades del prospecto" también.

La carta que estás viendo se llama "Oportunidades generadas" y es sólo de lectura: es un rastro histórico (leads antiguos que sí quedaron ligados a una oportunidad con el flujo viejo). En un lead nuevo siempre sale vacía y confunde, como pediste evitar.

## Qué cambia para el usuario

- En el detalle de un lead que aún no es prospecto, la carta "Oportunidades generadas" **desaparece cuando no hay ninguna** (el caso normal).
- Si un lead histórico sí tiene oportunidades ligadas, la carta se sigue mostrando para no perder la trazabilidad.
- Nada más cambia: prospectos siguen viendo su carta "Oportunidades del prospecto" con su botón de crear.

## Detalles técnicos

- `src/features/crm/components/LineageCard.tsx` · `LeadLineageCard`: cuando la consulta terminó sin error y `data.length === 0`, no renderizar la `Card` (retornar `null`); se conservan los estados de carga y error para no ocultar fallas. Se elimina el texto "Este lead aún no tiene oportunidades." por quedar sin uso.
- `src/features/crm/routes/LeadDetalle.tsx` no cambia: el gate `!esProspecto(lead.estado)` sigue igual.
- Prueba focalizada nueva junto a los tests del CRM: con 0 oportunidades no se pinta el título "Oportunidades generadas"; con una oportunidad sí.
- Cierre: bump patch 13.823.228, entrada en `CHANGELOG.md`, typecheck + ESLint focalizado + prueba focalizada + build. Sin migraciones, sin publicar; CI/RLS/suites completas en GitHub Actions.
