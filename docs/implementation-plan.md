# Implementation Plan

## V1

1. Replace the placeholder renderer with a WebGL scene and point cloud.
2. Map `X`, `Y`, and `Z` measures into normalized scene coordinates.
3. Add optional `Size`, `Color`, `Category`, and `Tooltip` bindings.
4. Integrate Power BI selection IDs so point picking participates in cross-filtering.
5. Add progressive data reduction guidance for 10K and 30K row scenarios.

## V1.5

1. Expose dense-scene controls for auto-rotation, legend visibility, point scaling, and render budgets.
2. Raise the categorical data window to support denser scenes before `fetchMoreData` is needed.
3. Keep the scene controls and performance card aligned with Power BI formatting model conventions.
4. Add a dependency-free WebGL renderer foundation with canvas fallback so the visual can scale beyond the original projected-canvas path.

## V2

1. Add `Shape` as a dimensional field well.
2. Support category-driven marker glyphs and legend behavior.
3. Evaluate chunked loading with `fetchMoreData` for larger semantic models.

## Risks to keep visible

- Export and certification requirements may constrain animation loops and external access.
- Large datasets will need level-of-detail or sampling instead of naive one-sphere-per-point rendering.
- The current docs support custom visuals broadly, but WebGL behavior should still be validated in the host with a concrete proof of concept.
