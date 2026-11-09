import { notifyError } from "@/lib/ui/appFeedback";
import { SIGN_OUT_FAILURE } from "./signOut";

/** UI boundary: only continue after confirmed logout, and never expose raw Auth errors. */
export async function signOutWithFeedback(
  signOut: () => Promise<void>,
  onSuccess?: () => void,
): Promise<void> {
  try {
    await signOut();
    onSuccess?.();
  } catch {
    // Auth/storage may throw tokens or server payloads. Keep a diagnostic error,
    // but never attach the raw exception (including its stack/cause).
    notifyError(undefined, {
      title: "No se pudo cerrar sesión", description: SIGN_OUT_FAILURE,
      error: new Error(SIGN_OUT_FAILURE),
    });
  }
}
