# Plan de cierre pre-release — Elogistix

Cierre del trabajo pendiente documentado en las auditorías del 18–19 de agosto. Cuatro olas, en orden de riesgo: primero dinero y datos, luego la cara pública, después pulido y candados de CI.

## Ola G1 — Dinero y seguridad (bloqueante)

Bugs con impacto en cifras o en datos, pendientes de la auditoría externa:

- Conceptos borrados que siguen apareciendo en el CFDI.
- Saldos con notas de crédito emitidas en otra moneda que la factura.
- Cancelación de embarques ya cerrados (debe bloquearse).
- Anticipos que no se reajustan al eliminar un pago.
- Columna "Cliente" vacía en el listado de cotizaciones (VR-2): el dato existe pero no llega a la tabla.
- Fechas: un solo formateador por contexto (VR-3) para que Cotizaciones y Embarques no muestren formatos distintos lado a lado.

Cada corrección lleva su prueba automatizada y su nota en el CHANGELOG.

## Ola G2 — La cara pública (Sprint 3 visual)

- `PortalPageShell`: el portal del cliente hoy es visualmente de otra familia; se alinea con el ERP (tipografía, superficies, espaciado).
- Tamaños táctiles mínimos y campana de notificaciones legible en móvil.
- `AuthCard` / `LegalShell`: login, recuperación y páginas legales bajo un mismo marco.
- Convergencia de Tesorería (módulo más divergente), incluyendo la tabla de flujo 30 días que corta la columna NETO.

## Ola H — Micro-pulido visible (Sprint 4 visual)

- Hero del dashboard principal: los tiles desbordan la pantalla (VR-1) → rejilla adaptable.
- KPI cards: color solo para alarma real, no para valores en cero (V-7); etiquetas sin mayúsculas forzadas.
- Emoji 👋 del saludo y avatar de foto stock del sidebar → iniciales con token de color (VR-5, VR-6).
- Leyendas y series de gráficas con `chartTokens` en lugar de colores saturados (VR-4).
- Chips de tipo de cotización con el mismo lenguaje que los de modo en Embarques (VR-8).
- Micro-copy uniforme ("Exportar PDF" en todos los módulos), ellipsis, casing, iconos `size-4`.

## Ola I — Candados de CI e higiene

- Reglas bloqueantes en CI: colores crudos (`text-red-500`, hex fuera de tokens), emojis en `.tsx`, `toFixed` en JSX, `h-4 w-4`, `title=` en tablas.
- `AUDIT-M16`: `.env` sigue rastreado en git. Requiere `git rm --cached .env` manual de tu parte (yo no ejecuto comandos de git) y rotación de llaves por higiene.
- Deuda menor de arquitectura: despachos largos, nombres de carpetas, limpieza de código muerto.

## Notas técnicas

- Sin funcionalidad nueva: todo es corrección, refactor o consolidación (compatible con feature freeze).
- Cada ola cierra con `APP_VERSION` + entrada en `CHANGELOG.md`.
- Las correcciones de base de datos van como migraciones con GRANT/RLS explícitos y pruebas en `supabase/tests/`.
- VR-7 (destello de skeleton en primera carga) queda fuera de alcance: es percepción de caché, no defecto; se evalúa aparte si se quiere prefetch.

## Secuencia sugerida

G1 (bloqueante) → G2 → H → I. G2 y H pueden avanzar en paralelo si prefieres ver resultados visuales antes.
