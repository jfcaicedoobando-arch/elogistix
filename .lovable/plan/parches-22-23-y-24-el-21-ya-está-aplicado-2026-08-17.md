# Parches 22, 23 y 24 (el 21 ya está aplicado)

Verifiqué los cuatro archivos con una aplicación en seco:

- **Parche 21 (regenerado):** todos los hunks salen como "previously applied". Ya quedó integrado en la versión 13.643.0, no hay nada que hacer.
- **Parche 22:** aplica limpio.
- **Parche 23:** aplica limpio.
- **Parche 24:** aplica salvo **un hunk**, porque el botón "Crear cotización" ya no vive en `OportunidadDetalleContent.tsx` (se movió a `OportunidadDetalleAcciones.tsx` durante la refactorización Power of 10). Se resuelve a mano cambiando el texto en el archivo nuevo.

## Qué cambia para el usuario

**Parche 22 — reportes, portales y tesorería**
- La bandeja "Por emitir" de proformas ya dice "Ninguna proforma aceptada pendiente de emitir" en vez del genérico.
- Gráfica de top clientes: nombres largos ya no se cortan tan pronto y si todo es $0 aparece un aviso en lugar de una gráfica vacía.
- Margen 0% cuando no hubo venta se pinta en gris (informativo), no en rojo de alarma.
- Portal: "Embarques activos" ya no cuenta los entregados, las cotizaciones sin desglose muestran "Total cotizado", y el aviso de rechazo incluye correo de contacto.
- Tesorería: el pie de la tabla de pagos programados cubre todo el ancho y el folio no se parte en dos líneas.

**Parche 23 — datos y sitio público**
- Corrige de raíz los nombres con acentos mal convertidos ("BAJíO") con una migración que hace mayúsculas Unicode en el trigger de razón social. Los nombres ya corruptos se limpian aparte.
- Landing: "3 minutos" en el KPI vacío, badge de video "1:00" en vez de "0:60", y "6 módulos" en vez de "11".
- Tesorería: se quita el "(USD)" repetido después del monto.
- Términos y condiciones: mientras el texto sea borrador, no se muestra fecha de última actualización.

**Parche 24 — copy y limpieza de componentes**
- Renombra `MobileFilterSheet` a `PortalFilterSheet` (con su prueba y los tres usos del portal).
- Copy en mayúscula tipo oración: "Nuevo embarque", "Nueva cotización", etc.

## Detalles técnicos

1. Aplicar 22 y 23 con `patch -p1`.
2. Aplicar 24 con `patch -p1` y resolver a mano el único hunk: cambiar "Crear cotización" → "Nueva cotización" en `src/features/crm/components/oportunidadDetalle/OportunidadDetalleAcciones.tsx`.
3. La migración del parche 23 llega con timestamp `20260825001000`; regenerar el espejo/manifest de migraciones si el guardrail lo exige.
4. Verificación: `tsgo --noEmit`, `eslint`, `audit:arch` (regla de 200 líneas) y la suite de vitest de los módulos tocados (portal, reportes, facturación, crm, embarques, `razonSocial`).
5. Bump de `APP_VERSION` a **13.644.0** y entrada en `CHANGELOG.md`.

## Riesgos conocidos (de los README)

- Excluir "Entregado" de embarques activos también lo saca del gráfico de distribución y de "Próximos arribos" del portal — es el comportamiento buscado, pero conviene mirarlo.
- La collation ICU de la migración tiene fallback a `upper()` estándar si el servidor no soporta ICU.
