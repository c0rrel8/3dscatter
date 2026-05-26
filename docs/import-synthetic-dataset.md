# Import Synthetic Dataset

Dataset file:

- [native-3d-scatter-synthetic-10000.csv](/C:/Users/corey/OneDrive/Documentos/Local%20Codex/3dscatter/data/native-3d-scatter-synthetic-10000.csv)

## Power BI Desktop

1. Open Power BI Desktop.
2. Choose `Get data`.
3. Select `Text/CSV`.
4. Open [native-3d-scatter-synthetic-10000.csv](/C:/Users/corey/OneDrive/Documentos/Local%20Codex/3dscatter/data/native-3d-scatter-synthetic-10000.csv).
5. In the preview, confirm:
   - `date` is typed as `Date`
   - `x`, `y`, `z`, `size`, and `color` are typed as decimal numbers
   - `category`, `tooltip`, and `nodeName` are typed as text
6. Click `Load`.

## Visual Well Mapping

- `X` -> `x`
- `Y` -> `y`
- `Z` -> `z`
- `Size` -> `size`
- `Category` -> `category`
- `Tooltip` -> `tooltip`

Notes:

- The visual no longer uses a `Color` well as of `0.4.0.0`.
- Keep the CSV `color` column in the model if you want to experiment with rule-based conditional formatting, but do not bind it to the visual. Use the `Markers` formatting card instead.

Suggested supporting fields for report testing:

- slicer or axis drill tests -> `date`
- cross-filter identity experiments -> `nodeName`

## Validation Ideas

- Bind the visual with `X`, `Y`, `Z`, `Size`, `Category`, and `Tooltip` and confirm point selection cross-filters.
- Add a slicer on `date` and verify the visual updates cleanly.
- Add a table visual with `nodeName`, `date`, and `category` to test bidirectional interactions.
- Toggle the visual diagnostics card to confirm renderer mode, update operation, and fetch state.
- In `Markers`, test the default marker color when `Category` is unbound, then bind `Category` and confirm per-category color entries and `fx` are available.
