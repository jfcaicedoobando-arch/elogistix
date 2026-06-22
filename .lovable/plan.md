## Diagnóstico

Solo falló el job **Lint** con 1 warning tratado como error:

```
src/features/cliente/components/clientesTableConfig.tsx:15
warning: Fast refresh only works when a file only exports components.
Use a new file to share constants or functions between components
(react-refresh/only-export-components)
```

El archivo exporta a la vez una constante (`clientesColumns`) y un componente (`ClienteMobileCard`), lo cual rompe HMR de React y dispara la regla. Tests, edge functions y coverage pasaron en verde.

Analogía: es como tener en la misma caja el manual de instrucciones y el control remoto — la regla pide cajas separadas.

## Solución

Separar en dos archivos dentro de `src/features/cliente/components/`:

1. **`clientesTableConfig.tsx`** (queda) → sólo `ClienteRow` (type) y `clientesColumns` (const).
2. **`ClienteMobileCard.tsx`** (nuevo) → sólo el componente.

Actualizar el import en `src/features/cliente/routes/Clientes.tsx` para tomar `ClienteMobileCard` del nuevo archivo (el resto desde `clientesTableConfig`).

## Versionado

- `APP_VERSION` → `13.97.3`
- Entrada nueva en `CHANGELOG.md`: `fix(cliente): separa ClienteMobileCard para satisfacer react-refresh/only-export-components`

## Validación

- `bun run lint -- --max-warnings 0` debe pasar.
- Sin cambios funcionales: el listado de clientes y la tarjeta móvil renderizan igual.
