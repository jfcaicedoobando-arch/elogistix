/**
 * Fixtures de autenticación para specs E2E. No usan storageState compartido
 * porque los flujos críticos quieren verificar el login real cada vez.
 */
import { expect, type Page } from "@playwright/test";

interface Creds {
  email: string;
  password: string;
}

function readCreds(envPrefix: "E2E" | "E2E_PORTAL"): Creds {
  const email = process.env[`${envPrefix}_EMAIL`];
  const password = process.env[`${envPrefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error(
      `Faltan variables de entorno ${envPrefix}_EMAIL / ${envPrefix}_PASSWORD. Ver e2e/README.md.`,
    );
  }
  return { email, password };
}

export const internalCreds = (): Creds => readCreds("E2E");
export const portalCreds = (): Creds => readCreds("E2E_PORTAL");

/** Realiza login desde / (formulario unificado). */
export async function loginAs(page: Page, creds: Creds): Promise<void> {
  await page.goto("/");
  await page.getByLabel(/correo|email/i).fill(creds.email);
  await page.getByLabel(/contrase/i).fill(creds.password);
  await page.getByRole("button", { name: /iniciar sesión|entrar|ingresar/i }).click();
  // Espera a que la app salga del login (ya sea dashboard interno o portal).
  await expect(page).not.toHaveURL(/\/$|\/login/i, { timeout: 20_000 });
}
