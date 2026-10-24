// StreamETH's colors (the logo's purple, streameth-light's slate ink) and
// its typeface, Inter.
import { loadFont } from "@remotion/google-fonts/Inter";

export const COLORS = {
  brand: "#6426EF", // the logo gradient's purple end
  ink: "#0F172A",
  white: "#FFFFFF",
  gradFrom: "#6426EF",
  gradTo: "#FF9976",
};

export const SANS = loadFont("normal", { weights: ["500", "600", "700"], subsets: ["latin"] }).fontFamily;
