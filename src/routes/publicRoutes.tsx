/**
 * Rutas públicas (sin autenticación) y redirects globales.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12).
 */
import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";

const Login = lazy(() => import("@/features/auth/routes/Login"));
const ResetPassword = lazy(() => import("@/features/auth/routes/ResetPassword"));
const NotFound = lazy(() => import("@/features/auth/routes/NotFound"));
const TrackingPublico = lazy(() => import("@/features/auth/routes/TrackingPublico"));
const Unsubscribe = lazy(() => import("@/features/auth/routes/Unsubscribe"));
const HomeRoute = lazy(() => import("@/features/marketing/routes/HomeRoute"));
const LogoPreview = lazy(() => import("@/features/marketing/routes/LogoPreview"));
const Privacidad = lazy(() => import("@/features/legal/routes/Privacidad"));
const Terminos = lazy(() => import("@/features/legal/routes/Terminos"));
const Seguridad = lazy(() => import("@/features/legal/routes/Seguridad"));
const GuiaCartaPorte = lazy(() => import("@/features/marketing/routes/GuiaCartaPorte"));
const GuiaIncoterms2020 = lazy(() => import("@/features/marketing/routes/GuiaIncoterms2020"));
const GuiaPuertosMexico = lazy(() => import("@/features/marketing/routes/GuiaPuertosMexico"));
const Onboarding = lazy(() => import("@/features/onboarding/routes/Onboarding"));
const PortalProforma = lazy(() => import("@/features/proformas/routes/PortalProforma"));
const PickersAudit = lazy(() => import("@/features/dev/routes/PickersAudit"));

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
    <Route path="/legal/seguridad" element={<Seguridad />} />
    <Route path="/recursos/guia-carta-porte-3" element={<GuiaCartaPorte />} />
    <Route path="/recursos/guia-incoterms-2020" element={<GuiaIncoterms2020 />} />
    <Route path="/recursos/guia-puertos-mexico" element={<GuiaPuertosMexico />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/portal/proformas/:token" element={<PortalProforma />} />
    <Route path="/dev/pickers-audit" element={<PickersAudit />} />
    <Route path="*" element={<NotFound />} />

  </>
);
