/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#10253f',
    tint: '#1464d2',

    // Core surfaces
    background: '#f5f8fc',
    foreground: '#10253f',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#10253f',

    // Primary action color (buttons, links, active states)
    primary: '#1464d2',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#eaf1fb',
    secondaryForeground: '#16437a',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#edf2f7',
    mutedForeground: '#66758a',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#fff1ed',
    accentForeground: '#b83824',

    // Destructive actions (delete, error states)
    destructive: '#e74b36',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#dce5ef',
    input: '#dce5ef',
  },

  dark: {
    text: '#f1f6fc',
    tint: '#7db2ff',
    background: '#0a1423',
    foreground: '#f1f6fc',
    card: '#122237',
    cardForeground: '#f1f6fc',
    primary: '#79adff',
    primaryForeground: '#071426',
    secondary: '#1a304c',
    secondaryForeground: '#dceaff',
    muted: '#15273c',
    mutedForeground: '#a7b7ca',
    accent: '#49251f',
    accentForeground: '#ffb8a9',
    destructive: '#ff7968',
    destructiveForeground: '#1b0906',
    border: '#29415d',
    input: '#29415d',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
