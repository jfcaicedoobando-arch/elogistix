/**
 * Rutas públicas (sin autenticación) y redirects globales.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12).
 */
import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";

const Login = lazy(() => import("@/pages/auth/Login"));
const NotFound = lazy(() => import("@/pages/auth/NotFound"));
const TrackingPublico = lazy(() => import("@/pages/auth/TrackingPublico"));
const HomeRoute = lazy(() => import("@/pages/marketing/HomeRoute"));

export const publicRoutes = (
  <>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/login" element={<Login />} />
    <Route path="/portal/login" element={<Navigate to="/login" replace />} />
    <Route path="/tracking/:token" element={<TrackingPublico />} />
    <Route path="*" element={<NotFound />} />
  </>
);
