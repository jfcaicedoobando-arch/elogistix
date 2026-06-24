/** Genera una contraseña legible de 12 chars (letras + dígitos + símbolo seguro). */
export function generarPasswordSegura(): string {
  const letras = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digitos = "23456789";
  const simbolos = "!@#$%*-_";
  const todo = letras + digitos + simbolos;
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < 12; i++) out += todo[arr[i] % todo.length];
  return out
    .replace(/^(.)(.)/, (_m, a) => `${a}${digitos[arr[0] % digitos.length]}${simbolos[arr[1] % simbolos.length]}`)
    .slice(0, 12);
}
