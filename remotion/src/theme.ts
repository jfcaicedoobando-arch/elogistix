import { loadFont } from "@remotion/google-fonts/Inter";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const colors = {
  primary: "#1B2B4B",
  accent: "#2563EB",
  accentSoft: "#60A5FA",
  bg: "#F8FAFC",
  bgAlt: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  line: "#CBD5E1",
  success: "#10B981",
  warn: "#F59E0B",
};
