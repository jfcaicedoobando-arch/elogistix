

## Módulo de Configuración — Recomendaciones

Después de analizar todo el código de la aplicación, estas son las variables y secciones que deberían vivir en un módulo de configuración centralizado, organizadas por categoría:

---

### 1. Tipos de Cambio por Defecto
- **Tipo de cambio USD/MXN** — actualmente hardcodeado como `17.25` en múltiples archivos (`useEmbarqueForm.ts`, `useExchangeRates.ts`, tabla `embarques` default `17.5`)
- **Tipo de cambio EUR/MXN** — hardcodeado como `18.50` / `19.0` en varios lugares
- Fuente de tipos de cambio: permitir elegir entre manual o API automática (ya existe edge function `exchange-rates`)

### 2. Datos de la Empresa
- Nombre de la empresa (`Elogistix Shipping` hardcodeado en `AppSidebar.tsx`)
- RFC de la empresa
- Dirección fiscal
- Logo (para PDF de cotizaciones/facturas futuras)
- Email de contacto principal
- Teléfono

### 3. Catálogos Operativos
- **Conceptos de costo/venta** — actualmente fijos en `CATALOGO_CONCEPTOS` (Flete Marítimo, Embalaje, Seguro de Carga, etc.)
- **Tipos de contenedor** — hardcodeados en `containerTypes.ts`
- **Puertos** — hardcodeados en `ports.ts`
- **Navieras/Líneas** — hardcodeadas en `shippingLines.ts`
- **Tipos de proveedor** — fijos en `proveedorConstants.ts`

### 4. Documentos Requeridos
- **Documentos por modo de transporte** — hardcodeados en `embarqueConstants.ts` (`getDocsForMode`)
- **Documentos obligatorios para clientes** — lista fija en `Clientes.tsx` (CIF, opinión fiscal, acta constitutiva, etc.)
- **Documentos obligatorios para proveedores nacionales** — lista fija en `NuevoProveedorDialog.tsx`

### 5. Facturación
- **Tasa de IVA** (actualmente no visible pero implícita; útil para futuros cálculos)
- **Días de vencimiento por defecto** para facturas
- **Serie y folio inicial** para numeración de facturas
- **Moneda predeterminada** para facturación

### 6. Cotizaciones
- **Vigencia por defecto** (actualmente hardcodeado como 15 días en `NuevaCotizacion.tsx`)
- **Días libres en destino por defecto**
- **Moneda predeterminada** para cotizaciones
- **Texto de términos y condiciones** (pie de cotización)

### 7. Embarques
- **Prefijo de expediente** (para la numeración automática de expedientes)
- **Estado inicial por defecto** (actualmente `Cotización`)
- **Tipo de carga por defecto** (actualmente `Carga General`)
- **Moneda predeterminada** para costos y ventas

### 8. Notificaciones y Alertas (Dashboard)
- **Días antes de ETA** para alertas de embarque próximo (hardcodeado como `7` y `3` días en `Dashboard.tsx`)
- **Umbral de facturas próximas a vencer**

### 9. Usuarios y Seguridad
- **Rol por defecto** para nuevos usuarios (actualmente `viewer` en el trigger `handle_first_user_role`)
- **Lista de operadores** disponibles para asignar a embarques/cotizaciones

---

### Implementación técnica propuesta

Se crearía una tabla `configuracion` en la base de datos con pares clave-valor (o JSON por categoría), un hook `useConfiguracion()` con cache via react-query, y una página `/configuracion` accesible solo para admins. Los valores se leerían desde el hook en lugar de las constantes hardcodeadas actuales.

Las fases serían:
1. Crear tabla y página de configuración con las secciones de Empresa y Tipos de Cambio
2. Migrar catálogos operativos (conceptos, puertos, navieras, contenedores)
3. Migrar parámetros de cotización, facturación y embarques
4. Migrar listas de documentos requeridos
5. Migrar umbrales de alertas del dashboard

