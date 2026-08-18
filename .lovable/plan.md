# Ola D — Validar P0/P1 con pruebas y cerrar marca + avatar

## Contexto verificado

Revisé el código antes de escribir esto:

- El P0 (**BUG-01**) ya está corregido en `facturapi-emitir`: filtra `deleted_at IS NULL` y además valida que los conceptos vigentes cuadren con el subtotal de la cabecera antes de timbrar.
- **UX-01** (sidebar "Principal" → `/inicio`), **UI-01** (`StatusBadge`), **UI-02** (estados vacíos) y **UI-04** (formateador de fechas) ya están cerrados en olas anteriores.
- Hay 27 suites SQL en `supabase/tests` y varias suites de servicio por hallazgo, pero la cobertura es **desigual**: por ejemplo no existe ninguna prueba que mencione `duplicar_factura_para_refacturacion` (BUG-08).
- El azul de la app es `--primary: 216 47% 20%` (≈ #1B3A5D), pero los PDFs usan `#0F4C81` y un `accent` `#2563EB` propios en `src/pdf/theme/tokens.ts`.

Lo que pediste: **no agregar features nuevos, sino demostrar con pruebas que cada P0/P1 está realmente cerrado y sin bugs**. Eso es el corazón de esta ola.

## Fase 1 — Matriz de cobertura P0/P1

Para cada uno de los 14 hallazgos (BUG-01…BUG-09, EC-01…EC-04, más los UX/UI de P1) se documenta en un archivo `docs/auditoria/cobertura-p0-p1.md`:

- hallazgo, archivo del fix, prueba que lo cubre, y veredicto: **cubierto** / **cubierto parcialmente** / **sin prueba**.
- Cada fila "sin prueba" se convierte en un test nuevo en la Fase 2.

## Fase 2 — Pruebas de regresión faltantes

Una prueba por hallazgo, escrita para **fallar si alguien revierte el fix**:

- **BUG-01** · timbrado: factura con un concepto en papelera → el payload al SAT no lo incluye; factura descuadrada → responde 422 sin llamar a FacturApi.
- **BUG-02** · `reemplazar_conceptos_factura_proveedor` recalcula subtotal/IVA/total de la cabecera.
- **BUG-03** · `crear_proforma_atomica`: folio único bajo dos llamadas, y una segunda llamada no "roba" conceptos ya ligados a otra proforma.
- **BUG-04** · `saldo_factura` con nota de crédito en USD sobre factura MXN: el saldo no se subestima ni la factura queda "Pagada".
- **BUG-05** · NC de cliente: `UPDATE` directo a "Aplicada" sin `uuid_fiscal` es rechazado por el trigger.
- **BUG-06** · cancelar factura de proveedor con rol operativo → bloqueado; con rol financiero → permitido.
- **BUG-07** · eliminar un pago originado en anticipo devuelve el saldo al anticipo.
- **BUG-08** · refacturación no hereda el T/C viejo: usa el DOF de la fecha nueva.
- **BUG-09** · embarque "Cerrado" no se puede cancelar.
- **EC-01** · comisiones: el filtro de período se aplica en SQL antes del límite y el truncamiento no es silencioso.
- **EC-02 / EC-04** · rutas de dinero fail-closed: error de Supabase o moneda desconocida abortan en lugar de asumir MXN.
- **EC-03** · `escapeIlike` en dedupe de leads, RFC duplicado y facturas de proveedor: un `_` en el correo no hace match comodín.

Las pruebas SQL entran a `supabase/tests` y se enganchan a las suites del CI existentes; las de frontend/servicio a `__tests__` junto a su módulo.

## Fase 3 — Cerrar UI-03 (marca) y VIS-06 (avatar)

- **Marca oficial: Libre Carga, azul #1B3A5D.** Los tokens del PDF (`src/pdf/theme/tokens.ts`) se derivan del azul de la app en lugar de tener su propio `#0F4C81` / `#2563EB`, así que una cotización en PDF y la pantalla muestran el mismo azul corporativo. Se revisan los textos de login, logo y pie de PDFs para que digan "Libre Carga".
- **Avatar con iniciales siempre**: se elimina la foto placeholder; el avatar del usuario muestra sus iniciales sobre un fondo derivado del nombre, en tokens del sistema (sirve también en modo oscuro).
- Guardrail: prueba de arquitectura que impide reintroducir un color de marca crudo en los tokens del PDF.

## Fase 4 — Verificación y cierre

- Ejecutar toda la batería: tests de front (`vitest`), suites SQL de RLS/financieras y los scripts `audit:*`.
- Reportar en chat qué hallazgos quedaron **verde con prueba**, y si alguno resulta **no cerrado**, listar el bug real encontrado antes de tocarlo.
- `CHANGELOG.md` + `APP_VERSION`.

## Fuera de alcance en esta ola

Los P2/P3 del documento (BUG-10…BUG-18, EC-05…EC-10, UI-05…UI-16, UX-10…UX-16 y los demás VIS) quedan para la siguiente ola, una vez que P0/P1 esté demostrado con pruebas.

## Notas técnicas

- Las pruebas SQL usan el patrón existente de `supabase/tests` (transacción + `RAISE EXCEPTION` con prefijo `LC_`), corridas por `$PSQL -f`.
- Para el trigger de NC y el rol financiero de CxP se reutilizan los helpers `public.rol_efectivo()` y los fixtures multi-tenant de `supabase/tests/rls`.
- La prueba de BUG-01 corre contra el handler de la edge function con un cliente Supabase simulado, sin llamar a FacturApi.
- Los tokens del PDF se derivan por constante hex equivalente al HSL del CSS (react-pdf no lee variables CSS), con la prueba de arquitectura vigilando la equivalencia.
