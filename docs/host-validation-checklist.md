# Host Validation Checklist

Use this checklist when loading the packaged visual into Power BI Desktop.

## Rendering

- Confirm the visual loads with the WebGL path active when `Renderer: WebGL` appears in the diagnostics panel.
- Confirm the canvas fallback still renders if WebGL is unavailable.
- Confirm axis colors, legend visibility, point size scaling, grid visibility, and background color respond to the Format pane.

## Interaction

- Confirm point click selection still cross-filters other visuals when `Category` is bound.
- Confirm external cross-filtering updates selected and highlighted states in this visual.
- Confirm tooltips, context menu, wheel zoom, drag orbit, keyboard orbit, and Escape-to-clear still behave correctly.
- Confirm read-only host mode disables interaction but still renders the scene.

## Data Loading

- Confirm dense scenes downsample to the configured render budget.
- Confirm diagnostics show the current update operation and fetch state.
- If `Auto-fetch more data` is enabled, confirm the visual requests more data near the configured trigger threshold and handles append/segment updates without breaking selection or rendering.

## Polish

- Confirm high contrast mode remains legible.
- Confirm no console errors appear during initial render, interaction, or append/segment updates.
- Confirm the packaged `.pbiviz` imports and renders consistently after reopening the report.
