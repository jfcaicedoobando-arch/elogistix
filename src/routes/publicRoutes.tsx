/**
 * Rutas públicas (sin autenticación) y redirects globales.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12).
 */
import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";

const Login = lazy(() => import("@/pages/auth/Login"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));
const NotFound = lazy(() => import("@/pages/auth/NotFound"));
const TrackingPublico = lazy(() => import("@/pages/auth/TrackingPublico"));
const Unsubscribe = lazy(() => import("@/pages/auth/Unsubscribe"));
const HomeRoute = lazy(() => import("@/pages/marketing/HomeRoute"));
const LogoPreview = lazy(() => import("@/pages/marketing/LogoPreview"));
const Privacidad = lazy(() => import("@/pages/legal/Privacidad"));
const Terminos = lazy(() => import("@/pages/legal/Terminos"));
const GuiaCartaPorte = lazy(() => import("@/pages/marketing/GuiaCartaPorte"));
const GuiaIncoterms2020 = lazy(() => import("@/pages/marketing/GuiaIncoterms2020"));
const Onboarding = lazy(() => import("@/pages/onboarding/Onboarding"));

export const publicRoutes = (
  <>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/login" element={<Login />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/portal/login" element={<Navigate to="/login" replace />} />
    <Route path="/tracking/:token" element={<TrackingPublico />} />
    <Route path="/unsubscribe" element={<Unsubscribe />} />
    <Route path="/logo-preview" element={<LogoPreview />} />
    <Route path="/legal/privacidad" element={<Privacidad />} />
    <Route path="/legal/terminos" element={<Terminos />} />
    <Route path="/recursos/guia-carta-porte-3" element={<GuiaCartaPorte />} />
    <Route path="/recursos/guia-incoterms-2020" element={<GuiaIncoterms2020 />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="*" element={<NotFound />} />

  </>
);
