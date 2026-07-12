/**
 * `useSafeNavigate` — envoltura de `useNavigate` que no truena cuando el
 * componente se monta fuera de un `<Router>` (p.ej. tests unitarios de
 * DataTable que renderizan sin `MemoryRouter`).
 *
 * En producción siempre hay router: retorna el `navigate` real.
 * En tests aislados: retorna un no-op sin lanzar `invariant`.
 *
 * Nota: el contexto de router es estable durante la vida del componente,
 * así que gatear con `useInRouterContext()` no rompe reglas de hooks en
 * la práctica.
 */
import { useInRouterContext, useNavigate, type NavigateFunction } from "react-router-dom";

const NOOP_NAVIGATE: NavigateFunction = () => {
  /* fuera de <Router>: no-op */
};

/* eslint-disable react-hooks/rules-of-hooks, react-compiler/react-compiler */
export function useSafeNavigate(): NavigateFunction {
  const inRouter = useInRouterContext();
  return inRouter ? useNavigate() : NOOP_NAVIGATE;
}
/* eslint-enable react-hooks/rules-of-hooks, react-compiler/react-compiler */
