## Plan: Ocultar toggle Míos/Todos para no-operadores

### Contexto

El dashboard tiene un toggle "Míos / Todos" (Tabs) que permite a los operadores filtrar su vista entre sus propias operaciones y todas las de la organización. Los usuarios Admin no tienen operaciones propias asignadas, por lo que este toggle no tiene sentido para ellos.

### Cambios

**Archivo:** `src/pages/dashboard/Dashboard.tsx`

1. **Inicialización de scope condicional:** Cambiar `useState<Scope>("mios")` a que dependa del rol:
  - Si `isOperador === true` → inicializa en `"mios"`
  - Si no → inicializa en `"todos"`
2. **Render condicional del toggle:** Envolver el bloque `<Tabs>` para que solo se renderice cuando `isOperador` sea `true`.

### Resultado esperado

- Los operadores ven el toggle y pueden cambiar entre "Míos" y "Todos" (default: Míos).
- Admins, vendedores y demás roles no ven el toggle y el dashboard siempre muestra todos los embarques.  Los vendedores si ven el toggle.