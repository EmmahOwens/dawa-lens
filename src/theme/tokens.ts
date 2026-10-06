// Design tokens for the Dawa‑Lens app based on DESIGN.md (Apple Design Analysis)
// Centralizes colors, spacing, radii, and typography so both Light and Dark modes stay consistent.

export const colors = {
  // Brand & Action
  primary: "#0066cc", // Action Blue — single brand-level interactive color
  primaryFocus: "#0071e3", // Focus Blue — keyboard focus ring root
  primaryOnDark: "#2997ff", // Sky Link Blue — interactive color on dark surfaces
  
  // Surfaces - Light
  canvas: "#ffffff", // Pure White dominant canvas
  canvasParchment: "#f5f5f7", // Apple Parchment — alternating light tiles, footers, sub-nav
  surfacePearl: "#fafafc", // Pearl Button capsule fill
  
  // Surfaces - Dark
  surfaceTile1: "#272729", // Primary dark tile surface
  surfaceTile2: "#2a2a2c", // Micro-step lighter dark tile
  surfaceTile3: "#252527", // Micro-step darker dark tile
  surfaceBlack: "#000000", // Pure black void & global nav
  
  // Controls & Translucency
  surfaceChipTranslucent: "rgba(210, 210, 215, 0.64)", // Light mode translucent chip
  surfaceChipDark: "rgba(255, 255, 255, 0.12)", // Dark mode translucent chip
  
  // Text & Ink - Light
  ink: "#1d1d1f", // Near-Black Ink — voice of headlines & body
  body: "#1d1d1f",
  inkMuted80: "#333333", // Slightly softer ink
  inkMuted48: "#7a7a7a", // Disabled button text and legal fine-print
  
  // Text & Ink - Dark
  bodyOnDark: "#ffffff", // All text on dark tiles & global nav
  bodyMuted: "#cccccc", // Secondary copy on dark tiles
  
  // Hairlines & Borders
  dividerSoft: "#f0f0f0", // Divider tone / subtle ring
  hairline: "#e0e0e0", // 1px hairline border on utility cards
  hairlineDark: "rgba(255, 255, 255, 0.12)", // 1px border on dark tiles
  
  // System Semantic
  success: "#34c759", // Apple System Green
  warning: "#ff9500", // Apple System Orange
  destructive: "#ff3b30", // Apple System Red
  
  // Backwards compat aliases
  background: "#ffffff",
  backgroundDark: "#000000",
  surface: "#ffffff",
  surfaceDark: "#272729",
  text: "#1d1d1f",
  textDark: "#ffffff",
  accent: "#0066cc",
};

export const typography = {
  fontDisplay: "SF Pro Display, system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  fontText: "SF Pro Text, system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  heroDisplay: {
    fontSize: "56px",
    fontWeight: "600",
    lineHeight: "1.07",
    letterSpacing: "-0.28px",
  },
  displayLg: {
    fontSize: "40px",
    fontWeight: "600",
    lineHeight: "1.10",
    letterSpacing: "0px",
  },
  displayMd: {
    fontSize: "34px",
    fontWeight: "600",
    lineHeight: "1.47",
    letterSpacing: "-0.374px",
  },
  lead: {
    fontSize: "28px",
    fontWeight: "400",
    lineHeight: "1.14",
    letterSpacing: "0.196px",
  },
  leadAiry: {
    fontSize: "24px",
    fontWeight: "300",
    lineHeight: "1.5",
    letterSpacing: "0px",
  },
  tagline: {
    fontSize: "21px",
    fontWeight: "600",
    lineHeight: "1.19",
    letterSpacing: "0.231px",
  },
  bodyStrong: {
    fontSize: "17px",
    fontWeight: "600",
    lineHeight: "1.24",
    letterSpacing: "-0.374px",
  },
  body: {
    fontSize: "17px",
    fontWeight: "400",
    lineHeight: "1.47",
    letterSpacing: "-0.374px",
  },
  denseLink: {
    fontSize: "17px",
    fontWeight: "400",
    lineHeight: "2.41",
    letterSpacing: "0px",
  },
  caption: {
    fontSize: "14px",
    fontWeight: "400",
    lineHeight: "1.43",
    letterSpacing: "-0.224px",
  },
  captionStrong: {
    fontSize: "14px",
    fontWeight: "600",
    lineHeight: "1.29",
    letterSpacing: "-0.224px",
  },
  buttonLarge: {
    fontSize: "18px",
    fontWeight: "300",
    lineHeight: "1.0",
    letterSpacing: "0px",
  },
  buttonUtility: {
    fontSize: "14px",
    fontWeight: "400",
    lineHeight: "1.29",
    letterSpacing: "-0.224px",
  },
  finePrint: {
    fontSize: "12px",
    fontWeight: "400",
    lineHeight: "1.0",
    letterSpacing: "-0.12px",
  },
  microLegal: {
    fontSize: "10px",
    fontWeight: "400",
    lineHeight: "1.3",
    letterSpacing: "-0.08px",
  },
};

export const rounded = {
  none: "0px",
  xs: "5px",
  sm: "8px",
  md: "11px",
  lg: "18px",
  pill: "9999px",
  full: "9999px",
};

export const spacing = {
  xxs: "4px",
  xs: "8px",
  sm: "12px",
  md: "17px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
  section: "80px",
};

export const shadows = {
  product: "rgba(0, 0, 0, 0.22) 3px 5px 30px 0px",
  productDark: "rgba(0, 0, 0, 0.55) 3px 5px 30px 0px",
};
