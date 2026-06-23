# Reorganizar dropdown de rol en "Nuevo Usuario"

## Problema
Hoy el `<Select>` de rol en `NuevoUsuarioDialog.tsx` muestra los 12 roles asignables en una lista plana, sin agrupar y sin jerarquía visual. Es difícil escanear y decidir.

## Analogía
Imagínate el menú de un restaurante con 12 platillos en una sola columna sin secciones. Ahora lo vamos a separar en "Entradas / Platos fuertes / Postres" — los mismos platillos, pero encuentras lo que buscas en segundos.

---

## 1) Agrupar los roles por área funcional

Reorganizar `ASSIGNABLE_ROLES_ADMIN_ORG` en **5 grupos** usando `<SelectGroup>` + `<SelectLabel>` de shadcn (componentes ya existen, sólo no se están usando):

```text
ADMINISTRACIÓN
  • Administrador (admin_org)

OPERACIONES
  • Gerente de Operaciones
  • Gerente Visor (solo lectura)
  • Coordinador Logístico

COMERCIAL
  • Gerente Comercial
  • Ejecutivo de Pricing
  • Vendedor / KAM

FINANZAS
  • Contador
  • Tesorero
  • Auxiliar Contable
  • Ejecutivo de Cobranza

SOPORTE
  • Atención a Clientes
```

Orden dentro de cada grupo: del más amplio (gerente) al más operativo.

## 2) Refinar las descripciones para que sean homogéneas

Las actuales (`ROLE_DESCRIPTIONS` en `roleCatalog.ts`) son aceptables pero mezclan tono y largo. Reescribirlas con un patrón consistente: **"Qué hace · Qué ve · Qué NO puede"** en 1–2 frases, máximo ~140 caracteres para que entren bien en el item del Select sin truncarse demasiado.

Ejemplos del nuevo formato (las 12 asignables; legacy se conservan sin tocar):

| Rol | Nueva descripción |
|---|---|
| Administrador | Dueño funcional de la organización. Administra usuarios, configuración, catálogos y todos los módulos. |
| Gerente de Operaciones | Supervisa embarques, documentación y operativo diario. Lee finanzas y aprueba; no toca configuración ni usuarios. |
| Gerente Visor (solo lectura) | Ve toda la operación y finanzas de la organización. No crea, edita ni aprueba nada. Ideal para auditoría o dirección. |
| Coordinador Logístico | Opera cotizaciones, embarques, tracking y documentos. No ve márgenes, costos internos ni datos financieros. |
| Gerente Comercial | Supervisa al equipo de ventas. Ve CRM completo, cotizaciones con márgenes, clientes y comisiones. Sin tesorería ni usuarios. |
| Ejecutivo de Pricing | Arma cotizaciones con costos y P&L preliminar. Ve márgenes de sus cotizaciones; sin acceso a tesorería ni facturación. |
| Vendedor / KAM | Trabaja CRM (leads, oportunidades, actividades) y ve embarques y cobranza de sus cuentas asignadas. |
| Contador | Emite facturas a cliente, aprueba notas de crédito y supervisa el estado de resultados. Acceso financiero completo. |
| Tesorero | Ejecuta pagos a proveedores, conciliación bancaria y liquidación de comisiones. No emite facturas. |
| Auxiliar Contable | Captura facturas de proveedor (XML/PDF) y las concilia contra costos del embarque. No autoriza pagos. |
| Ejecutivo de Cobranza | Da seguimiento a cartera vencida, registra promesas de pago y captura cobros. No emite facturas ni autoriza pagos. |
| Atención a Clientes | Solo lectura operativa: embarques, tracking, clientes. Sin acceso a finanzas, configuración ni CRM. |

> El bloque inferior del modal (`<p className="rounded-md border …">{ROLE_DESCRIPTIONS[role]}</p>`) seguirá mostrando la descripción **completa** del rol seleccionado, así que dentro del dropdown podemos seguir usando `line-clamp-2` (subir de `line-clamp-1` actual a 2 líneas para que se lea mejor el resumen sin saturar).

## 3) Detalles de implementación

**Archivos a editar:**

- `src/features/admin/domain/roles/roleCatalog.ts`
  - Reemplazar los strings de `ROLE_DESCRIPTIONS` para los 12 roles asignables (no tocar `super_admin`, `cliente`, ni los 3 legacy — no aparecen en este modal).
  - Agregar y exportar:
    ```ts
    export interface RoleGroup { label: string; roles: readonly AppRole[]; }
    export const ASSIGNABLE_ROLE_GROUPS: readonly RoleGroup[] = [
      { label: "Administración", roles: ["admin_org"] },
      { label: "Operaciones", roles: ["gerente_operaciones","gerente_visor","coordinador_logistico"] },
      { label: "Comercial", roles: ["gerente_comercial","ejecutivo_pricing","vendedor"] },
      { label: "Finanzas", roles: ["contador","tesorero","auxiliar_contable","ejecutivo_cobranza"] },
      { label: "Soporte", roles: ["customer_service"] },
    ];
    ```
  - Mantener `ASSIGNABLE_ROLES_ADMIN_ORG` (la usan otros lugares) — derivarla de los grupos para que no se desincronicen:
    ```ts
    export const ASSIGNABLE_ROLES_ADMIN_ORG = ASSIGNABLE_ROLE_GROUPS.flatMap(g => g.roles);
    ```

- `src/features/admin/components/usuario/NuevoUsuarioDialog.tsx`
  - Importar `SelectGroup`, `SelectLabel`, `SelectSeparator` desde `@/components/ui/select`.
  - Importar `ASSIGNABLE_ROLE_GROUPS` en lugar de iterar la lista plana.
  - Renderizar `<SelectGroup>` por cada grupo con su `<SelectLabel>` y un `<SelectSeparator />` entre grupos (excepto el último).
  - Cambiar `line-clamp-1` a `line-clamp-2` en la descripción dentro del item.

**Sin cambios en BD, sin migraciones, sin hooks, sin nuevas dependencias.** `Select*` ya está en shadcn (`src/components/ui/select.tsx`).

**Compatibilidad:** `ASSIGNABLE_ROLES_ADMIN_ORG` mantiene su tipo y contenido (mismos roles, mismo orden derivado). Cualquier otro consumidor (tests, otros componentes) sigue funcionando.

**Versionado:**
- Bump `APP_VERSION` → `13.117.4` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md`: "Admin: dropdown de rol en *Nuevo Usuario* agrupado por área (Administración / Operaciones / Comercial / Finanzas / Soporte) con descripciones homogéneas."

**Pruebas:** no se agregan tests nuevos (cambio de presentación + texto). Si existen snapshots del modal, se actualizan al correr la suite.
