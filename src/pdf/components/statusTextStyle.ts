import { COLORS, FONTS } from "../theme/tokens";

/** Text always carries the state; color is only a supporting cue. */
export function statusTextStyle(value: string) {
  const state = value.trim().toLocaleLowerCase("es");
  const color = /^(pagad[oa]|conciliad[oa]|aprobad[oa]|aceptad[oa]|cerrad[oa])$/.test(state)
    ? COLORS.successFg
    : /^(vencid[oa]|rechazad[oa])$/.test(state)
      ? COLORS.dangerFg
      : /^(pendiente|parcial|borrador)$/.test(state)
        ? COLORS.warningFg
        : COLORS.primary;
  return { color, fontFamily: FONTS.bold };
}
