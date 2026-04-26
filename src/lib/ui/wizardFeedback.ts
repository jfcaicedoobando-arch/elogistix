/**
 * Compat shim — la implementación se movió a `appFeedback.ts` (v8.97.0)
 * para reflejar que las severidades aplican a toda la app, no solo al wizard.
 */
export { notifyError, notifySuccess, notifyWarning, type ErrorNotifyOptions } from "./appFeedback";
