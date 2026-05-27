# Notas de versión — Libre Carga 12.0

> Borrador para `12.0.0` (GA). Mantener en español MX, tono orientado a usuario final.
> Actualizar fecha y número de RC al cortar el release.

## Resumen

Libre Carga 12.0 es la **primera versión estable** de la plataforma de gestión para
agentes de carga (forwarders). Consolida 11 ciclos de iteración interna y queda
lista para uso operativo diario por equipos de tu organización.

## Módulos disponibles

- **Clientes**: alta guiada con lectura automática de CSF (SAT), catálogo de
  contactos, documentos obligatorios, identificadores fiscales internacionales.
- **Cotizaciones**: conceptos en MXN y USD con tipo de cambio dinámico (BCE),
  IVA configurable, conversión directa a embarque y a proforma/factura.
- **Embarques**: ciclo completo FCL y LCL, 7 estados operativos, tracking
  automático con JSONCargo, bitácora por embarque, alertas de demurrage en sidebar.
- **CRM**: pipeline de oportunidades editable, captura de leads, "Next Best
  Action" sugerido, leaderboard y forecast mensual.
- **Portal cliente**: vista de embarques y documentos limitada a su organización,
  gráficas de carga, descargas seguras.
- **Administración**: configuración global (tasas IVA, plataforma, seguridad),
  bitácora de actividad, auditoría con filtros, gestión unificada de usuarios.

## Requisitos

- Navegador moderno (Chrome / Edge / Firefox / Safari actualizados).
- Conexión a internet estable.
- Resolución mínima recomendada: 1280 × 720.

## Limitaciones conocidas

- Tracking automático limitado a navieras soportadas por JSONCargo.
- Exportaciones grandes (> 5 000 filas) requieren paginar.
- Los reportes CRM agregados tienen cap defensivo en 5 000 filas; por encima,
  contactar soporte para migrar a reporte server-side.

## Cambios desde 11.x

Resumen alto nivel (detalle técnico completo en `CHANGELOG.md`):

- Endurecimiento de seguridad: SECURITY DEFINER auditado, RLS revisada,
  edge functions con roles obligatorios.
- 770 pruebas automatizadas verdes, baseline Power of 10 limpia.
- Paginación server-side en todas las vistas de lista.
- Auditoría de complejidad ciclomática; refactors completados en hotspots.

## Soporte

- Reporte de incidentes: __
- Documentación operativa: ver `docs/operations.md` interno.
- Procedimiento de rollback: ver `docs/backups-rollback.md`.

## Política de versionado

A partir de 12.0, Libre Carga sigue [SemVer](https://semver.org):

- **MAJOR (X.0.0)**: cambios incompatibles que requieren acción del usuario.
- **MINOR (12.X.0)**: nuevas funcionalidades retrocompatibles.
- **PATCH (12.0.X)**: correcciones sin cambios visibles.
- **Pre-release**: `12.0.0-rc.N` para Release Candidates durante el periodo de testing.
