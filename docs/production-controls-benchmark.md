# Production Controls Benchmark

Date: 2026-04-03

## Reference Visual

- Visual: `Advance Card`
- Package inspected: `C:\Users\corey\Downloads\advanceCardE03760C5AB684758B56AA29F9E6C257B.2.1.1.0.pbiviz`
- Source repo: `https://github.com/bhavesh-jadav/Advance-Card/`

## Why This Reference Matters

`Advance Card` is not a 3D visual, so it is not a renderer model for us. It is useful because it is a mature Power BI custom visual with a much broader formatting and packaging surface than our current v0.2.0.0 visual.

The main lesson is not "copy these exact controls." The lesson is that production visuals usually:

- expose more formatting cards than a prototype
- separate general layout controls from data encoding controls
- offer explicit typography and spacing controls
- provide fallback text/value behavior rather than only field-driven behavior
- organize settings around user outcomes, not internal implementation details

## Current Visual Surface

Our current format pane is intentionally narrow and is grouped into four cards:

- `Scene`
- `Markers`
- `Performance`
- `Diagnostics`

That is a good v1 shape, but it is still more of an engineering surface than a polished report-author surface.

## What `Advance Card` Does Better

From the inspected package and GitHub source, `Advance Card` exposes a much richer formatting model:

- separate label groups instead of one generic formatting bucket
- alignment and spacing controls
- typography controls per content type
- explicit conditional formatting controls
- fallback text behavior when optional bound fields are absent

Notable formatting groups visible in its `capabilities.json`:

- `Data Label`
- `Category Label`
- `Prefix Label`
- `Postfix Label`
- `Conditions`

Notable control patterns visible there:

- color
- display units
- decimal places
- font size
- font family
- bold / italic
- word wrap
- alignment
- spacing
- show / hide toggles per subcomponent
- text fallback properties

## What Applies To Our 3D Scatter

These ideas transfer well:

- split one broad card into more author-friendly groups
- add show/hide controls for distinct visual subcomponents
- add spacing, sizing, and typography controls where text appears
- add more intentional legend controls
- add conditional emphasis styling rather than only raw highlight state

These ideas do not transfer directly:

- prefix/postfix labels
- single-value card formatting patterns
- display units / decimals for one main scalar value as a primary UX model

## Recommended Backlog For Our Visual

### Tier 1: High Value, Strong Fit

These would make our visual feel much more production-ready without changing the core interaction model.

1. `Legend` card
- show / hide legend
- legend title toggle
- legend position
- legend max items
- legend text color
- legend font size

2. `Axes` card
- show / hide axes
- show / hide grid
- axis label toggle
- axis title text override
- axis label color
- axis line thickness

3. `Selection & Highlight` card
- selected point opacity
- unselected point opacity
- highlight color override
- hover ring / outline toggle
- background-click clear toggle

4. `Camera` card
- reset camera action support if feasible
- auto-rotate toggle
- auto-rotate speed
- zoom sensitivity
- orbit sensitivity
- default camera preset

### Tier 2: Medium Value, Strong Fit

These improve author control and readability.

1. `Markers` expansion
- min point size
- max point size
- outline toggle
- outline color
- outline width
- category color strategy

2. `Labels / Tooltips` card
- tooltip enable / disable
- tooltip field label verbosity
- tooltip numeric precision
- persistent hover label toggle for selected points

3. `Performance` expansion
- explicit displayed point count in diagnostics
- downsampling strategy choice
- render budget presets
- fetch indicator toggle

### Tier 3: Useful Later

These are worth doing after the large-data and interaction story is stable.

1. `Conditional Styling`
- conditional marker color by threshold
- conditional marker opacity
- conditional marker size emphasis

2. `Shape`
- dedicated `Shape` field well
- manual shape override
- legend integration for shapes

3. `Theme / Accessibility`
- high-contrast overrides
- colorblind-safe palette presets
- keyboard help overlay

## Recommended Restructure

Instead of keeping all author-facing controls under only `Scene` and `Markers`, the better medium-term card model is:

- `Scene`
- `Axes`
- `Markers`
- `Legend`
- `Selection & Highlight`
- `Camera`
- `Performance`
- `Diagnostics`

That structure is closer to how report authors think about the visual.

## Concrete Next Build Slice

The highest-value next formatting slice is:

1. create `Axes`, `Legend`, and `Selection & Highlight` cards
2. move existing controls into those cards
3. add only 2-4 new controls per card, not dozens at once
4. keep `Performance` and `Diagnostics` separate so the author UX does not get polluted by engineering toggles

## Bottom Line

One mature reference visual was enough to confirm the main pattern: production Power BI visuals expose a broader, more author-centered formatting surface than we do today.

We do not need more references yet to know the next move. The right next step is to reshape our format pane around report-author tasks and add a focused first wave of `Axes`, `Legend`, and `Selection & Highlight` controls.
