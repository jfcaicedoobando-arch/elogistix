
# Mejora UX del Tab Cierre: deep-links accionables por check

## Problema

Hoy el checklist de cierre muestra ❌/✅ y un `JSON.stringify(detalle)` poco legible. Si Isela ve "cxp_sin_pendientes: Pendiente", tiene que adivinar a dónde ir, abrir otro tab, buscar el embarque, y resolver. El cierre se vuelve un juego del gato.

## Solución

Convertir cada item del checklist en una tarjeta accionable:

1. **Etiqueta clara** (ya existe).
2. **Detalle legible** en español (no JSON crudo): "Faltan 2 facturas de proveedor por capturar", "Cliente debe $14,500 MXN", etc.
3. **Botón "Resolver"** que abre la **sub-tab del embarque actual** cuando aplica (preserva contexto) o la **bandeja global filtrada por este embarque** cuando no.
4. **Etiqueta "Responsable"**: chip pequeño indicando qué rol debe actuar (Contador, Tesorero, Operador, Coordinador). Útil para que Isela sepa cuándo el bloqueo no es suyo y a quién pedirle.

## Mapeo check → destino → responsable

| Check | Destino (preferido sub-tab embarque) | Responsable |
|---|---|---|
| `cxc_sin_pendientes` / `cxc_cobrada` | Tab "Cobranza" del embarque → fallback `/cartera?embarque=:id` | Contador / Cobranza |
| `cxp_sin_pendientes` / `cxp_pagada` | Tab "Pagos a proveedor" del embarque → fallback `/cxp/por-pagar?embarque=:id` | Tesorero |
| `documentos_completos` / `docs_completos` | Tab "Documentos" del embarque | Coordinador logístico |
| `venta_conceptos_facturados` | Tab "Facturación" del embarque → fallback `/facturacion/por-emitir?embarque=:id` | Contador |
| `costo_conceptos_con_factura` | Tab "Costos" del embarque → fallback `/cxp/por-capturar?embarque=:id` | Auxiliar contable |
| `costos_liquidados` | Tab "Pagos a proveedor" → fallback `/cxp/por-pagar?embarque=:id` | Tesorero |
| `pnl_margen_minimo` | Tab "P&L" del embarque (sólo info, no es accionable directo) | Ventas / Gerente |
| `comision_calculada` | Botón "Recalcular comisión" inline (RPC ya existente) | Sistema / Admin |
| `contenedores_datos_completos` | Tab "Contenedores" del embarque | Operador |

Los slugs de sub-tab los confirmo leyendo `EmbarqueDetalle.tsx` durante la implementación (uso `useTabsParam` para conmutar tab sin recargar).

## Cambios técnicos

- **Nuevo** `src/features/embarques/components/cierre/CierreCheckItem.tsx`: tarjeta presentacional por check con ícono, etiqueta, detalle formateado, chip de responsable y botón "Resolver".
- **Nuevo** `src/features/embarques/utils/cierreCheckMeta.ts`: tabla pura `regla → { label, responsable, ruta(embarqueId), formatDetalle(detalle) }`. Función pura → testeable.
- **Refactor** `CierreChecklistCard.tsx`: en vez de `<li>` inline, renderiza `<CierreCheckItem />`. Recibe `embarqueId` como prop nueva.
- **Refactor** `TabCierre.tsx`: pasa `embarqueId` al checklist (ya lo tiene). Sin cambios de lógica.
- **Test** `cierreCheckMeta.test.ts`: cubre formato de detalle por cada regla y que la ruta generada sea correcta.

## Lo que el usuario verá

Antes:
```
❌ Cuentas por pagar al día    [Pendiente]
   {"facturas_pendientes":2,"monto":14500}
```

Después:
```
❌ Cuentas por pagar al día    [Pendiente]   Tesorero
   2 facturas de proveedor pendientes de pago por $14,500 MXN
                                                  [Resolver →]
```

Click en "Resolver" → abre el Tab "Pagos a proveedor" del mismo embarque.

## Sin tocar

- RPC `validar_cierre_embarque` (sigue devolviendo el mismo shape).
- Lógica de cierre, permisos, RLS, BD.
- Tab Cierre sigue funcionando idéntico para admin/finanzas y operadores.

## Versionado

`APP_VERSION` → `13.89.2` + entrada en `CHANGELOG.md` ("UX: deep-links accionables en checklist de cierre").
