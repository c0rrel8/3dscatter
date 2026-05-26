# Standalone Voxel Scene

This is a standalone Three.js app that renders a fixed orthographic isometric `5x5x5` voxel lattice on black.

## Scene rules

- blue anchor at `(0, 0, 4)`
- white anchor at `(0, 4, 0)`
- red anchor at `(4, 0, 0)`
- every non-anchor voxel uses normalized inverse-square weighting from only those three anchors

## Run locally

```powershell
cd 'C:\Users\corey\OneDrive\Documentos\Local Codex\3dscatter\standalone'
npm install --ignore-scripts --cache ..\.npm-cache\standalone-npm-cache
npm start
```

Then open `http://localhost:4173`.
