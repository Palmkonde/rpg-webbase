// Every value the built-in overlays take from a CSS variable, set by a Platform on the mount element or any ancestor.
// Fallbacks live only where a value is used, so nothing the package renders shadows a Platform's override.
export const theme = {
  font: 'var(--rpg-font, inherit)',
  text: 'var(--rpg-text, white)',
  panelBackground: 'var(--rpg-panel-bg, rgba(20, 20, 20, 0.9))',
  panelRadius: 'var(--rpg-panel-radius, 0.5rem)',
  cgBackground: 'var(--rpg-cg-bg, black)',
} as const
