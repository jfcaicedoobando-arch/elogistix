# Decisiones técnicas

- Notas de crédito por embarque: cada renglón de NC copiado de la factura guarda `concepto_factura_id`; `_venta_facturada_por_embarque` resta esa base al embarque del concepto y sólo prorratea renglones sin linaje (manuales o históricos), y el trigger `_nc_validar_linaje_conceptos` rechaza ids ajenos o créditos mayores al subtotal del concepto. Why: atribución exacta sin inventar linaje histórico ni tocar XML/PDF.
- Seguros de embarque: una póliza puede ligarse opcionalmente a la factura de proveedor que documenta su prima (`seguros_embarque.proveedor_factura_id`); el trigger `_seguro_validar_factura_proveedor` exige misma org, factura vigente del embarque (también al restaurar), un índice único impide dos pólizas activas con la misma factura, y `pnl_financiero_embarque` omite la prima ligada porque ya cuenta la factura. Why: no contar dos veces el mismo gasto sin inferir vínculos ni tocar históricos.

- Proveedores provisionales (`estado_alta`): alta vía `crear_agente_provisional`, aprobación sólo contador/admin vía `aprobar_proveedor_provisional`; triggers bloquean facturas/pagos. Why: tarifas sin esperar a Contabilidad, sin pagar a no verificados.

- Replay de provisionales: Drizzle0013/190000 son historia literal;190100 cierra ejecución directa de los dos triggers y190200 corrige sólo los cuatro appends de faltantes, reafirmando la ACL original del RPC sin ampliar roles. La release13.824.46 conserva UI199 e historial35–44 sin crear45; su regresión funcional se registra como guard. Why: separar reconstrucción histórica, corrección forward, pruebas de catálogo y autorización de aplicación remota, sin ocultar drift ni reescribir historia.

- Catálogos globales: anon no tiene privilegios sobre planes/navieras/puertos/tipos_contenedor/tipos_cambio_dof; authenticated conserva CRUD RLS sólo en los primeros cuatro y SELECT en DOF. Planes comunes filtran activo IS TRUE; super_admin conserva inactivos y RPC manual DOF. Why: quitar privilegios fuera de RLS sin romper la administración existente ni la lectura global operativa. Aplicación remota exige envelope revisado y aprobación específica.

- Análisis financiero: DSO/DPO usan cartera promedio y actividad propia a crédito neta documentada del mismo mes/moneda; runway exige tres meses calendario completos cerrados de consumo operativo y caja conciliada con restricciones al corte explícito aplicable, no anterior al fin observado ni futuro respecto de la fecha de negocio. Why: los cinco criterios aprobados el 2026-10-13 fijan políticas, no certifican datos; lectores actuales y flags/IDs del cliente mantienen N/D sin fallback de EERR o próximos 30 días.

- Demo deshabilitada (13.824.84): UI sin formulario/leads/login, Edge sin proveedor y 503 previo a Auth/SQL, y cuatro rutas SQL bloqueadas antes de DML. No revoca sesiones ni cambia identidades; no habilitar mediante flags/request ni restaurar el seed destructivo. Why: cerrar la release mientras se revisan procedencia y regeneración segura.

- Subdirectorios (`src/features/crm`, `cotizacion`, `proformas`, `cxp`) tienen su propio `AGENTS.md`: léelo antes de cambiar archivos ahí.

- Margen mínimo comercial: se lee con `useMargenMinimo` (config `comercial/margen_minimo_utilidad_pct`, default en `lib/domain/margenMinimo.ts`) y sólo se escribe por el RPC `set_margen_minimo_utilidad` (admin/gerente_comercial); la edición de embarques exige autorización sólo si cambió montos y el margen queda por debajo. Why: un solo umbral configurable reutilizable en cotizaciones.
