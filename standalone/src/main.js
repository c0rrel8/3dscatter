import {
    ALIGNMENT_OPTIONS,
    BLEND_MODES,
    VOXEL_PRIMITIVES,
    describeColorModels,
    listUniqueCorners,
    mountVoxelScene,
    sampleVoxelColor
} from "./voxelScene.js";

const MAX_DIMENSION = 10;
const MIN_DIMENSION = 1;
const PRESET_STORAGE_KEY = "voxel-scene-presets-v1";
const TRANSITION_STORAGE_KEY = "voxel-scene-transitions-v1";
const SEQUENCE_STORAGE_KEY = "voxel-scene-sequence-v1";

const BLEND_MODE_LABELS = {
    rgb: "RGB",
    hsl: "HSL",
    oklch: "OKLCH"
};
const PRIMITIVE_LABELS = {
    cube: "Cube",
    sphere: "Sphere",
    octahedron: "Octahedron",
    tetrahedron: "Tetrahedron",
    icosahedron: "Icosahedron",
    dodecahedron: "Dodecahedron"
};
const ALIGNMENT_LABELS = {
    min: "Min",
    center: "Center",
    max: "Max"
};

const state = {
    blendMode: "rgb",
    primitive: "cube",
    showAxes: true,
    showLabels: false,
    dimensions: { x: 5, y: 5, z: 5 },
    view: { azimuth: 45, elevation: 35.26, zoom: 1 },
    probe: { x: 0, y: 0, z: 0 },
    cornerColors: {},
    presets: loadStoredArray(PRESET_STORAGE_KEY, isValidPresetRecord, sortByUpdatedDesc),
    selectedPresetId: "",
    presetDraftName: "",
    transitions: loadStoredArray(TRANSITION_STORAGE_KEY, isValidTransitionRecord, sortByUpdatedDesc),
    selectedTransitionId: "",
    transitionDraft: null,
    sequenceTransitionIds: loadStoredArray(SEQUENCE_STORAGE_KEY, (value) => typeof value === "string"),
    selectedSequenceIndex: 0
};

syncCornerColorsToDimensions();
state.selectedPresetId = state.presets[0]?.id ?? "";
state.presetDraftName = state.presets[0]?.name ?? deriveNextPresetName();
state.selectedTransitionId = state.transitions[0]?.id ?? "";
state.transitionDraft = state.transitions[0]
    ? createTransitionDraftFromRecord(state.transitions[0])
    : createDefaultTransitionDraft();

let playback = null;

const app = document.querySelector("#app");

if (!app) {
    throw new Error("App root was not found.");
}

app.innerHTML = `
    <div class="layout">
        <canvas class="scene-canvas" aria-label="Orthographic isometric voxel scene"></canvas>
        <aside class="hud">
            <p class="eyebrow">Orthographic Isometric</p>
            <h1 class="title"></h1>
            <p class="copy"></p>
            <div class="view-actions">
                <label class="checkbox-row">
                    <input type="checkbox" name="showAxes" />
                    <span>Show axes and ticks</span>
                </label>
                <label class="checkbox-row">
                    <input type="checkbox" name="showLabels" />
                    <span>Show per-cube hex labels</span>
                </label>
                <button type="button" class="reset-button">Reset view</button>
            </div>
            <form class="controls" autocomplete="off">
                <section class="control-section">
                    <div class="section-heading">
                        <h2>Presets</h2>
                        <p class="preset-summary"></p>
                    </div>
                    <label>
                        <span>Preset name</span>
                        <input type="text" name="preset-name" maxlength="80" placeholder="Preset name" />
                    </label>
                    <label>
                        <span>Saved presets</span>
                        <select name="preset-select" size="5"></select>
                    </label>
                    <div class="action-row">
                        <button type="button" class="preset-save-button">Save New</button>
                        <button type="button" class="preset-overwrite-button">Overwrite</button>
                        <button type="button" class="preset-load-button">Load</button>
                        <button type="button" class="preset-delete-button">Delete</button>
                    </div>
                </section>

                <section class="control-section">
                    <div class="section-heading">
                        <h2>Transitions</h2>
                        <p class="transition-summary"></p>
                    </div>
                    <label>
                        <span>Transition name</span>
                        <input type="text" name="transition-name" maxlength="80" placeholder="Transition name" />
                    </label>
                    <div class="detail-grid detail-grid--two">
                        <label>
                            <span>From preset</span>
                            <select name="transition-from"></select>
                        </label>
                        <label>
                            <span>To preset</span>
                            <select name="transition-to"></select>
                        </label>
                    </div>
                    <div class="detail-grid">
                        <label>
                            <span>Duration ms</span>
                            <input type="number" name="transition-duration" min="100" max="30000" step="50" />
                        </label>
                        <label>
                            <span>FPS</span>
                            <input type="number" name="transition-fps" min="1" max="60" step="1" />
                        </label>
                        <label>
                            <span>Azimuth delta</span>
                            <input type="number" name="transition-azimuth" step="0.1" />
                        </label>
                    </div>
                    <div class="detail-grid">
                        <label>
                            <span>Elevation delta</span>
                            <input type="number" name="transition-elevation" step="0.1" />
                        </label>
                        <label>
                            <span>Zoom delta</span>
                            <input type="number" name="transition-zoom" step="0.05" />
                        </label>
                        <label>
                            <span>Saved transitions</span>
                            <select name="transition-select" size="4"></select>
                        </label>
                    </div>
                    <div class="detail-grid">
                        <label>
                            <span>Align X</span>
                            <select name="transition-align-x"></select>
                        </label>
                        <label>
                            <span>Align Y</span>
                            <select name="transition-align-y"></select>
                        </label>
                        <label>
                            <span>Align Z</span>
                            <select name="transition-align-z"></select>
                        </label>
                    </div>
                    <div class="action-row action-row--wide">
                        <button type="button" class="transition-save-button">Save New</button>
                        <button type="button" class="transition-overwrite-button">Overwrite</button>
                        <button type="button" class="transition-preview-button">Preview</button>
                        <button type="button" class="transition-delete-button">Delete</button>
                        <button type="button" class="transition-add-sequence-button">Add To Sequence</button>
                    </div>
                </section>

                <section class="control-section">
                    <div class="section-heading">
                        <h2>Sequence</h2>
                        <p class="sequence-summary"></p>
                    </div>
                    <label>
                        <span>Transition chain</span>
                        <select name="sequence-select" size="6"></select>
                    </label>
                    <div class="action-row action-row--wide">
                        <button type="button" class="sequence-up-button">Move Up</button>
                        <button type="button" class="sequence-down-button">Move Down</button>
                        <button type="button" class="sequence-remove-button">Remove</button>
                        <button type="button" class="sequence-clear-button">Clear</button>
                        <button type="button" class="sequence-play-button">Play Chain</button>
                        <button type="button" class="sequence-stop-button">Stop</button>
                    </div>
                </section>

                <section class="control-section">
                    <div class="section-heading">
                        <h2>Scene Data</h2>
                        <p class="data-summary"></p>
                    </div>
                    <div class="action-row action-row--wide">
                        <button type="button" class="data-export-button">Export JSON</button>
                        <button type="button" class="data-copy-button">Copy JSON</button>
                        <button type="button" class="data-import-button">Import JSON</button>
                    </div>
                    <label>
                        <span>Presets, transitions, and sequence JSON</span>
                        <textarea name="data-json" rows="10" spellcheck="false"></textarea>
                    </label>
                </section>

                <section class="control-section">
                    <div class="section-heading">
                        <h2>Primitive</h2>
                        <p>Display each occupied voxel cell with a chosen geometric glyph.</p>
                    </div>
                    <label>
                        <span>Voxel primitive</span>
                        <select name="primitive"></select>
                    </label>
                </section>

                <section class="control-section">
                    <div class="section-heading">
                        <h2>Blend Mode</h2>
                        <p>Keep corner hex values fixed and switch only the interpolation math.</p>
                    </div>
                    <label>
                        <span>Working color space</span>
                        <select name="blend-mode"></select>
                    </label>
                </section>

                <section class="control-section">
                    <div class="section-heading">
                        <h2>View</h2>
                        <p>Numeric orbit and orthographic zoom controls.</p>
                    </div>
                    <div class="number-grid">
                        <label>
                            <span>Azimuth</span>
                            <input type="number" name="view-azimuth" step="0.1" />
                        </label>
                        <label>
                            <span>Elevation</span>
                            <input type="number" name="view-elevation" min="-89" max="89" step="0.1" />
                        </label>
                        <label>
                            <span>Zoom</span>
                            <input type="number" name="view-zoom" min="0.2" max="6" step="0.1" />
                        </label>
                    </div>
                </section>

                <section class="control-section">
                    <div class="section-heading">
                        <h2>Probe</h2>
                        <p>Sample the exact computed color at any voxel coordinate.</p>
                    </div>
                    <div class="number-grid">
                        <label>
                            <span>X</span>
                            <input type="number" name="probe-x" min="0" step="1" />
                        </label>
                        <label>
                            <span>Y</span>
                            <input type="number" name="probe-y" min="0" step="1" />
                        </label>
                        <label>
                            <span>Z</span>
                            <input type="number" name="probe-z" min="0" step="1" />
                        </label>
                    </div>
                    <div class="probe-readout">
                        <div class="probe-chip"></div>
                        <div class="probe-values">
                            <strong class="probe-hex"></strong>
                            <span class="probe-rgb"></span>
                            <span class="probe-hsl"></span>
                            <span class="probe-oklch"></span>
                        </div>
                    </div>
                </section>

                <section class="control-section">
                    <div class="section-heading">
                        <h2>Dimensions</h2>
                        <p>Overall voxel counts along each axis.</p>
                    </div>
                    <div class="number-grid">
                        <label>
                            <span>X</span>
                            <input type="number" name="dimension-x" min="${MIN_DIMENSION}" max="${MAX_DIMENSION}" step="1" />
                        </label>
                        <label>
                            <span>Y</span>
                            <input type="number" name="dimension-y" min="${MIN_DIMENSION}" max="${MAX_DIMENSION}" step="1" />
                        </label>
                        <label>
                            <span>Z</span>
                            <input type="number" name="dimension-z" min="${MIN_DIMENSION}" max="${MAX_DIMENSION}" step="1" />
                        </label>
                    </div>
                </section>

                <section class="control-section">
                    <div class="section-heading">
                        <h2>Corners</h2>
                        <p class="corner-summary"></p>
                    </div>
                    <div class="corner-grid"></div>
                </section>
            </form>
        </aside>
    </div>
`;

const canvas = app.querySelector(".scene-canvas");
const titleNode = app.querySelector(".title");
const copyNode = app.querySelector(".copy");
const form = app.querySelector(".controls");
const axesToggle = app.querySelector('input[name="showAxes"]');
const labelToggle = app.querySelector('input[name="showLabels"]');
const resetButton = app.querySelector(".reset-button");
const presetNameInput = app.querySelector('input[name="preset-name"]');
const presetSelect = app.querySelector('select[name="preset-select"]');
const presetSaveButton = app.querySelector(".preset-save-button");
const presetOverwriteButton = app.querySelector(".preset-overwrite-button");
const presetLoadButton = app.querySelector(".preset-load-button");
const presetDeleteButton = app.querySelector(".preset-delete-button");
const presetSummary = app.querySelector(".preset-summary");
const transitionNameInput = app.querySelector('input[name="transition-name"]');
const transitionSelect = app.querySelector('select[name="transition-select"]');
const transitionSaveButton = app.querySelector(".transition-save-button");
const transitionOverwriteButton = app.querySelector(".transition-overwrite-button");
const transitionPreviewButton = app.querySelector(".transition-preview-button");
const transitionDeleteButton = app.querySelector(".transition-delete-button");
const transitionAddSequenceButton = app.querySelector(".transition-add-sequence-button");
const transitionSummary = app.querySelector(".transition-summary");
const sequenceSelect = app.querySelector('select[name="sequence-select"]');
const sequenceUpButton = app.querySelector(".sequence-up-button");
const sequenceDownButton = app.querySelector(".sequence-down-button");
const sequenceRemoveButton = app.querySelector(".sequence-remove-button");
const sequenceClearButton = app.querySelector(".sequence-clear-button");
const sequencePlayButton = app.querySelector(".sequence-play-button");
const sequenceStopButton = app.querySelector(".sequence-stop-button");
const sequenceSummary = app.querySelector(".sequence-summary");
const dataExportButton = app.querySelector(".data-export-button");
const dataCopyButton = app.querySelector(".data-copy-button");
const dataImportButton = app.querySelector(".data-import-button");
const dataSummary = app.querySelector(".data-summary");
const dataJsonTextarea = app.querySelector('textarea[name="data-json"]');
const primitiveSelect = app.querySelector('select[name="primitive"]');
const blendModeSelect = app.querySelector('select[name="blend-mode"]');
const probeChip = app.querySelector(".probe-chip");
const probeHex = app.querySelector(".probe-hex");
const probeRgb = app.querySelector(".probe-rgb");
const probeHsl = app.querySelector(".probe-hsl");
const probeOklch = app.querySelector(".probe-oklch");
const cornerGrid = app.querySelector(".corner-grid");
const cornerSummary = app.querySelector(".corner-summary");

if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(titleNode instanceof HTMLElement) ||
    !(copyNode instanceof HTMLElement) ||
    !(form instanceof HTMLFormElement) ||
    !(axesToggle instanceof HTMLInputElement) ||
    !(labelToggle instanceof HTMLInputElement) ||
    !(resetButton instanceof HTMLButtonElement) ||
    !(presetNameInput instanceof HTMLInputElement) ||
    !(presetSelect instanceof HTMLSelectElement) ||
    !(presetSaveButton instanceof HTMLButtonElement) ||
    !(presetOverwriteButton instanceof HTMLButtonElement) ||
    !(presetLoadButton instanceof HTMLButtonElement) ||
    !(presetDeleteButton instanceof HTMLButtonElement) ||
    !(presetSummary instanceof HTMLElement) ||
    !(transitionNameInput instanceof HTMLInputElement) ||
    !(transitionSelect instanceof HTMLSelectElement) ||
    !(transitionSaveButton instanceof HTMLButtonElement) ||
    !(transitionOverwriteButton instanceof HTMLButtonElement) ||
    !(transitionPreviewButton instanceof HTMLButtonElement) ||
    !(transitionDeleteButton instanceof HTMLButtonElement) ||
    !(transitionAddSequenceButton instanceof HTMLButtonElement) ||
    !(transitionSummary instanceof HTMLElement) ||
    !(sequenceSelect instanceof HTMLSelectElement) ||
    !(sequenceUpButton instanceof HTMLButtonElement) ||
    !(sequenceDownButton instanceof HTMLButtonElement) ||
    !(sequenceRemoveButton instanceof HTMLButtonElement) ||
    !(sequenceClearButton instanceof HTMLButtonElement) ||
    !(sequencePlayButton instanceof HTMLButtonElement) ||
    !(sequenceStopButton instanceof HTMLButtonElement) ||
    !(sequenceSummary instanceof HTMLElement) ||
    !(dataExportButton instanceof HTMLButtonElement) ||
    !(dataCopyButton instanceof HTMLButtonElement) ||
    !(dataImportButton instanceof HTMLButtonElement) ||
    !(dataSummary instanceof HTMLElement) ||
    !(dataJsonTextarea instanceof HTMLTextAreaElement) ||
    !(primitiveSelect instanceof HTMLSelectElement) ||
    !(blendModeSelect instanceof HTMLSelectElement) ||
    !(probeChip instanceof HTMLElement) ||
    !(probeHex instanceof HTMLElement) ||
    !(probeRgb instanceof HTMLElement) ||
    !(probeHsl instanceof HTMLElement) ||
    !(probeOklch instanceof HTMLElement) ||
    !(cornerGrid instanceof HTMLElement) ||
    !(cornerSummary instanceof HTMLElement)
) {
    throw new Error("Control elements were not found.");
}

hydrateStaticSelects();

const scene = mountVoxelScene(canvas, getSceneConfig(), {
    onViewChange(nextView) {
        state.view.azimuth = nextView.azimuth;
        state.view.elevation = nextView.elevation;
        state.view.zoom = nextView.zoom;
        syncViewInputs();
    }
});

axesToggle.addEventListener("change", () => {
    state.showAxes = axesToggle.checked;
    pushStateToScene();
});

labelToggle.addEventListener("change", () => {
    state.showLabels = labelToggle.checked;
    pushStateToScene();
});

form.addEventListener("input", handleFormMutation);
form.addEventListener("change", handleFormMutation);

resetButton.addEventListener("click", () => {
    stopPlayback();
    scene.resetView();
});

presetSaveButton.addEventListener("click", saveNewPreset);
presetOverwriteButton.addEventListener("click", overwriteSelectedPreset);
presetLoadButton.addEventListener("click", loadSelectedPreset);
presetDeleteButton.addEventListener("click", deleteSelectedPreset);

transitionSaveButton.addEventListener("click", saveNewTransition);
transitionOverwriteButton.addEventListener("click", overwriteSelectedTransition);
transitionPreviewButton.addEventListener("click", previewSelectedTransition);
transitionDeleteButton.addEventListener("click", deleteSelectedTransition);
transitionAddSequenceButton.addEventListener("click", addSelectedTransitionToSequence);

sequenceUpButton.addEventListener("click", () => moveSequenceItem(-1));
sequenceDownButton.addEventListener("click", () => moveSequenceItem(1));
sequenceRemoveButton.addEventListener("click", removeSelectedSequenceItem);
sequenceClearButton.addEventListener("click", clearSequence);
sequencePlayButton.addEventListener("click", playSequence);
sequenceStopButton.addEventListener("click", stopPlayback);
dataExportButton.addEventListener("click", exportSceneDataToTextarea);
dataCopyButton.addEventListener("click", copySceneDataToClipboard);
dataImportButton.addEventListener("click", importSceneDataFromTextarea);

syncFormFromState();
pushStateToScene();

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        stopPlayback(false);
        scene.destroy();
    });
}

function hydrateStaticSelects() {
    primitiveSelect.innerHTML = VOXEL_PRIMITIVES.map(
        (primitive) => `<option value="${primitive}">${PRIMITIVE_LABELS[primitive]}</option>`
    ).join("");

    blendModeSelect.innerHTML = BLEND_MODES.map(
        (mode) => `<option value="${mode}">${BLEND_MODE_LABELS[mode]}</option>`
    ).join("");

    setNamedSelectOptions("transition-align-x", ALIGNMENT_OPTIONS, ALIGNMENT_LABELS);
    setNamedSelectOptions("transition-align-y", ALIGNMENT_OPTIONS, ALIGNMENT_LABELS);
    setNamedSelectOptions("transition-align-z", ALIGNMENT_OPTIONS, ALIGNMENT_LABELS);
}

function handleFormMutation(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
        return;
    }

    if (target.name === "showAxes" || target.name === "showLabels") {
        return;
    }

    if (target.name === "preset-name") {
        state.presetDraftName = presetNameInput.value;
        return;
    }

    if (target.name === "preset-select") {
        state.selectedPresetId = target.value;
        state.presetDraftName = getSelectedPreset()?.name ?? deriveNextPresetName();
        syncPresetControls();
        return;
    }

    if (target.name.startsWith("transition-")) {
        handleTransitionDraftMutation(target);
        return;
    }

    if (target.name === "sequence-select") {
        state.selectedSequenceIndex = Math.max(0, target.selectedIndex);
        syncSequenceControls();
        return;
    }

    if (target instanceof HTMLInputElement && target.name.startsWith("view-")) {
        stopPlayback();
        applyViewFromForm();
        return;
    }

    if (target instanceof HTMLInputElement && target.name.startsWith("corner-")) {
        stopPlayback();
        applyCornerColorFromInput(target);
        return;
    }

    stopPlayback();
    applyStateFromForm();
}

function handleTransitionDraftMutation(target) {
    if (!state.transitionDraft) {
        state.transitionDraft = createDefaultTransitionDraft();
    }

    switch (target.name) {
        case "transition-select":
            state.selectedTransitionId = target.value;
            state.transitionDraft = getSelectedTransition()
                ? createTransitionDraftFromRecord(getSelectedTransition())
                : createDefaultTransitionDraft();
            break;
        case "transition-name":
            state.transitionDraft.name = transitionNameInput.value;
            break;
        case "transition-from":
            state.transitionDraft.fromPresetId = getSelectValue("transition-from", state.transitionDraft.fromPresetId);
            break;
        case "transition-to":
            state.transitionDraft.toPresetId = getSelectValue("transition-to", state.transitionDraft.toPresetId);
            break;
        case "transition-duration":
            state.transitionDraft.durationMs = clampInteger(getNumberInputValue("transition-duration", state.transitionDraft.durationMs), 100, 30000);
            break;
        case "transition-fps":
            state.transitionDraft.fps = clampInteger(getNumberInputValue("transition-fps", state.transitionDraft.fps), 1, 60);
            break;
        case "transition-azimuth":
            state.transitionDraft.viewDelta.azimuth = getFloatInputValue("transition-azimuth", state.transitionDraft.viewDelta.azimuth);
            break;
        case "transition-elevation":
            state.transitionDraft.viewDelta.elevation = getFloatInputValue("transition-elevation", state.transitionDraft.viewDelta.elevation);
            break;
        case "transition-zoom":
            state.transitionDraft.viewDelta.zoom = getFloatInputValue("transition-zoom", state.transitionDraft.viewDelta.zoom);
            break;
        case "transition-align-x":
            state.transitionDraft.alignment.x = getAlignmentValue("transition-align-x", state.transitionDraft.alignment.x);
            break;
        case "transition-align-y":
            state.transitionDraft.alignment.y = getAlignmentValue("transition-align-y", state.transitionDraft.alignment.y);
            break;
        case "transition-align-z":
            state.transitionDraft.alignment.z = getAlignmentValue("transition-align-z", state.transitionDraft.alignment.z);
            break;
        default:
            break;
    }

    syncTransitionControls();
}

function applyStateFromForm() {
    captureCornerColorsFromInputs();
    state.primitive = getPrimitiveValue("primitive", state.primitive);
    state.blendMode = getBlendModeValue("blend-mode", state.blendMode);

    const nextDimensions = {
        x: clampInteger(getNumberInputValue("dimension-x", state.dimensions.x), MIN_DIMENSION, MAX_DIMENSION),
        y: clampInteger(getNumberInputValue("dimension-y", state.dimensions.y), MIN_DIMENSION, MAX_DIMENSION),
        z: clampInteger(getNumberInputValue("dimension-z", state.dimensions.z), MIN_DIMENSION, MAX_DIMENSION)
    };

    state.dimensions = nextDimensions;
    syncCornerColorsToDimensions();
    state.probe = {
        x: clampInteger(getNumberInputValue("probe-x", state.probe.x), 0, nextDimensions.x - 1),
        y: clampInteger(getNumberInputValue("probe-y", state.probe.y), 0, nextDimensions.y - 1),
        z: clampInteger(getNumberInputValue("probe-z", state.probe.z), 0, nextDimensions.z - 1)
    };

    syncFormFromState();
    pushStateToScene();
}

function applyViewFromForm() {
    const nextView = {
        azimuth: normalizeDegrees(getFloatInputValue("view-azimuth", state.view.azimuth)),
        elevation: clamp(getFloatInputValue("view-elevation", state.view.elevation), -89, 89),
        zoom: clamp(getFloatInputValue("view-zoom", state.view.zoom), 0.2, 6)
    };

    state.view = nextView;
    scene.setView(nextView);
    syncViewInputs();
}

function applyCornerColorFromInput(input) {
    const key = input.name.replace("corner-", "");
    const fallback = state.cornerColors[key] ?? "#FFFFFF";
    state.cornerColors[key] = getColorInputValue(input.name, fallback);
    updateCornerEducationCard(key);
    pushStateToScene();
}

function saveNewPreset() {
    stopPlayback();
    captureCornerColorsFromInputs();
    const preset = createPresetRecord(getPresetDraftName());
    state.presets = sortByUpdatedDesc([preset, ...state.presets]);
    state.selectedPresetId = preset.id;
    state.presetDraftName = preset.name;
    persistStoredArray(PRESET_STORAGE_KEY, state.presets);
    ensureTransitionDraftPresetIds();
    syncPresetControls();
    syncTransitionControls();
}

function overwriteSelectedPreset() {
    stopPlayback();
    if (!state.selectedPresetId) {
        saveNewPreset();
        return;
    }

    captureCornerColorsFromInputs();
    const index = state.presets.findIndex((preset) => preset.id === state.selectedPresetId);
    if (index === -1) {
        saveNewPreset();
        return;
    }

    const preset = createPresetRecord(getPresetDraftName(), state.presets[index]);
    state.presets[index] = preset;
    state.presets = sortByUpdatedDesc(state.presets);
    state.selectedPresetId = preset.id;
    state.presetDraftName = preset.name;
    persistStoredArray(PRESET_STORAGE_KEY, state.presets);
    syncPresetControls();
    syncTransitionControls();
}

function loadSelectedPreset() {
    stopPlayback();
    const preset = getSelectedPreset();
    if (!preset) {
        return;
    }

    applyPresetRecord(preset);
    syncFormFromState();
    pushStateToScene();
}

function deleteSelectedPreset() {
    stopPlayback();
    if (!state.selectedPresetId) {
        return;
    }

    const deletedId = state.selectedPresetId;
    state.presets = state.presets.filter((preset) => preset.id !== deletedId);
    state.selectedPresetId = state.presets[0]?.id ?? "";
    state.presetDraftName = state.presets[0]?.name ?? deriveNextPresetName();
    persistStoredArray(PRESET_STORAGE_KEY, state.presets);

    state.transitions = state.transitions.filter(
        (transition) => transition.fromPresetId !== deletedId && transition.toPresetId !== deletedId
    );
    state.sequenceTransitionIds = state.sequenceTransitionIds.filter((id) => state.transitions.some((transition) => transition.id === id));
    state.selectedTransitionId = state.transitions[0]?.id ?? "";
    state.transitionDraft = state.transitions[0]
        ? createTransitionDraftFromRecord(state.transitions[0])
        : createDefaultTransitionDraft();
    persistStoredArray(TRANSITION_STORAGE_KEY, state.transitions);
    persistStoredArray(SEQUENCE_STORAGE_KEY, state.sequenceTransitionIds);

    syncFormFromState();
    pushStateToScene();
}

function saveNewTransition() {
    stopPlayback();
    const record = createTransitionRecord(state.transitionDraft);
    state.transitions = sortByUpdatedDesc([record, ...state.transitions]);
    state.selectedTransitionId = record.id;
    state.transitionDraft = createTransitionDraftFromRecord(record);
    persistStoredArray(TRANSITION_STORAGE_KEY, state.transitions);
    syncTransitionControls();
    syncSequenceControls();
}

function overwriteSelectedTransition() {
    stopPlayback();
    if (!state.selectedTransitionId) {
        saveNewTransition();
        return;
    }

    const index = state.transitions.findIndex((transition) => transition.id === state.selectedTransitionId);
    if (index === -1) {
        saveNewTransition();
        return;
    }

    const record = createTransitionRecord(state.transitionDraft, state.transitions[index]);
    state.transitions[index] = record;
    state.transitions = sortByUpdatedDesc(state.transitions);
    state.selectedTransitionId = record.id;
    state.transitionDraft = createTransitionDraftFromRecord(record);
    persistStoredArray(TRANSITION_STORAGE_KEY, state.transitions);
    syncTransitionControls();
    syncSequenceControls();
}

function deleteSelectedTransition() {
    stopPlayback();
    if (!state.selectedTransitionId) {
        return;
    }

    const deletedId = state.selectedTransitionId;
    state.transitions = state.transitions.filter((transition) => transition.id !== deletedId);
    state.sequenceTransitionIds = state.sequenceTransitionIds.filter((id) => id !== deletedId);
    state.selectedTransitionId = state.transitions[0]?.id ?? "";
    state.transitionDraft = state.transitions[0]
        ? createTransitionDraftFromRecord(state.transitions[0])
        : createDefaultTransitionDraft();
    state.selectedSequenceIndex = clampInteger(state.selectedSequenceIndex, 0, Math.max(0, state.sequenceTransitionIds.length - 1));
    persistStoredArray(TRANSITION_STORAGE_KEY, state.transitions);
    persistStoredArray(SEQUENCE_STORAGE_KEY, state.sequenceTransitionIds);
    syncTransitionControls();
    syncSequenceControls();
}

function previewSelectedTransition() {
    const record = getSelectedTransition();
    if (!record) {
        return;
    }

    playTransitionRecords([record]);
}

function addSelectedTransitionToSequence() {
    const record = getSelectedTransition();
    if (!record) {
        return;
    }

    state.sequenceTransitionIds.push(record.id);
    state.selectedSequenceIndex = state.sequenceTransitionIds.length - 1;
    persistStoredArray(SEQUENCE_STORAGE_KEY, state.sequenceTransitionIds);
    syncSequenceControls();
}

function moveSequenceItem(direction) {
    if (state.sequenceTransitionIds.length === 0) {
        return;
    }

    const currentIndex = clampInteger(state.selectedSequenceIndex, 0, state.sequenceTransitionIds.length - 1);
    const nextIndex = clampInteger(currentIndex + direction, 0, state.sequenceTransitionIds.length - 1);
    if (currentIndex === nextIndex) {
        return;
    }

    const reordered = [...state.sequenceTransitionIds];
    const [item] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, item);
    state.sequenceTransitionIds = reordered;
    state.selectedSequenceIndex = nextIndex;
    persistStoredArray(SEQUENCE_STORAGE_KEY, state.sequenceTransitionIds);
    syncSequenceControls();
}

function removeSelectedSequenceItem() {
    if (state.sequenceTransitionIds.length === 0) {
        return;
    }

    state.sequenceTransitionIds.splice(state.selectedSequenceIndex, 1);
    state.selectedSequenceIndex = clampInteger(state.selectedSequenceIndex, 0, Math.max(0, state.sequenceTransitionIds.length - 1));
    persistStoredArray(SEQUENCE_STORAGE_KEY, state.sequenceTransitionIds);
    syncSequenceControls();
}

function clearSequence() {
    stopPlayback();
    state.sequenceTransitionIds = [];
    state.selectedSequenceIndex = 0;
    persistStoredArray(SEQUENCE_STORAGE_KEY, state.sequenceTransitionIds);
    syncSequenceControls();
}

function playSequence() {
    const records = state.sequenceTransitionIds
        .map((id) => state.transitions.find((transition) => transition.id === id))
        .filter(Boolean);

    playTransitionRecords(records);
}

function playTransitionRecords(records) {
    const playable = records
        .map(resolvePlaybackRecord)
        .filter(Boolean);

    if (playable.length === 0) {
        return;
    }

    stopPlayback(false);
    playback = {
        items: playable,
        index: 0,
        startedAt: performance.now(),
        lastView: null,
        frameHandle: 0
    };
    syncSequenceControls();
    playback.frameHandle = window.requestAnimationFrame(stepPlayback);
}

function stepPlayback(now) {
    if (!playback) {
        return;
    }

    const item = playback.items[playback.index];
    const frame = buildTransitionFrame(item, now - playback.startedAt, playback.lastView);
    scene.setConfig(frame.config);
    scene.setView(frame.view);

    if (frame.completed) {
        playback.lastView = frame.view;
        playback.index += 1;

        if (playback.index >= playback.items.length) {
            applyPresetRecord(item.toPreset);
            state.view = { ...frame.view };
            syncFormFromState();
            pushStateToScene();
            stopPlayback(false);
            return;
        }

        playback.startedAt = now;
    }

    playback.frameHandle = window.requestAnimationFrame(stepPlayback);
}

function stopPlayback(restoreScene = true) {
    if (playback?.frameHandle) {
        window.cancelAnimationFrame(playback.frameHandle);
    }
    playback = null;
    syncSequenceControls();

    if (restoreScene) {
        pushStateToScene();
    }
}

function resolvePlaybackRecord(record) {
    const fromPreset = state.presets.find((preset) => preset.id === record.fromPresetId);
    const toPreset = state.presets.find((preset) => preset.id === record.toPresetId);
    if (!fromPreset || !toPreset) {
        return null;
    }

    return { ...record, fromPreset, toPreset };
}

function buildTransitionFrame(record, elapsedMs, priorView) {
    const durationMs = Math.max(100, record.durationMs);
    const fps = clampInteger(record.fps, 1, 60);
    const frameCount = Math.max(2, Math.round((durationMs / 1000) * fps));
    const rawProgress = clamp(elapsedMs / durationMs, 0, 1);
    const frameIndex = Math.min(frameCount - 1, Math.floor(rawProgress * (frameCount - 1) + 1e-9));
    const progress = frameCount === 1 ? 1 : frameIndex / (frameCount - 1);
    const completed = elapsedMs >= durationMs;
    const dimensions = interpolateDimensions(record.fromPreset.scene.dimensions, record.toPreset.scene.dimensions, progress);
    const steppedConfig = sceneSnapshotToConfig(record.toPreset.scene, {
        dimensions,
        alignment: record.alignment,
        colorOverrides: buildTransitionColorOverrides(record, dimensions)
    });
    const startView = priorView ?? record.fromPreset.scene.view;
    const endView = {
        azimuth: normalizeDegrees(record.toPreset.scene.view.azimuth),
        elevation: clamp(record.toPreset.scene.view.elevation + record.viewDelta.elevation, -89, 89),
        zoom: clamp(record.toPreset.scene.view.zoom + record.viewDelta.zoom, 0.2, 6)
    };

    return {
        completed,
        config: completed ? sceneSnapshotToConfig(record.toPreset.scene) : steppedConfig,
        view: {
            azimuth: interpolateAzimuthWithSpin(startView.azimuth, endView.azimuth, record.viewDelta.azimuth, progress),
            elevation: lerp(startView.elevation, endView.elevation, progress),
            zoom: lerp(startView.zoom, endView.zoom, progress)
        }
    };
}

function interpolateDimensions(fromDimensions, toDimensions, progress) {
    return {
        x: interpolateSteppedAxis(fromDimensions.x, toDimensions.x, progress),
        y: interpolateSteppedAxis(fromDimensions.y, toDimensions.y, progress),
        z: interpolateSteppedAxis(fromDimensions.z, toDimensions.z, progress)
    };
}

function interpolateSteppedAxis(fromValue, toValue, progress) {
    return clampInteger(fromValue + (toValue - fromValue) * progress, MIN_DIMENSION, MAX_DIMENSION);
}

function buildTransitionColorOverrides(record, currentDimensions) {
    const overrides = {};
    const fromConfig = sceneSnapshotToConfig(record.fromPreset.scene);
    const toConfig = sceneSnapshotToConfig(record.toPreset.scene);

    for (let x = 0; x < currentDimensions.x; x += 1) {
        for (let y = 0; y < currentDimensions.y; y += 1) {
            for (let z = 0; z < currentDimensions.z; z += 1) {
                const currentCoordinate = { x, y, z };
                const sourceCoordinate = mapCoordinateBetweenAlignedShapes(currentCoordinate, currentDimensions, record.fromPreset.scene.dimensions, record.alignment);
                const targetCoordinate = mapCoordinateBetweenAlignedShapes(currentCoordinate, currentDimensions, record.toPreset.scene.dimensions, record.alignment);

                let sample = null;
                if (sourceCoordinate) {
                    sample = sampleVoxelColor(fromConfig, sourceCoordinate);
                } else if (targetCoordinate) {
                    sample = sampleVoxelColor(toConfig, targetCoordinate);
                }

                if (!sample) {
                    continue;
                }

                overrides[coordinateKey(currentCoordinate)] = sample.hex;
            }
        }
    }

    return overrides;
}

function mapCoordinateBetweenAlignedShapes(coordinate, currentDimensions, targetDimensions, alignment) {
    const x = mapAxisBetweenAlignedShapes(coordinate.x, currentDimensions.x, targetDimensions.x, alignment.x);
    const y = mapAxisBetweenAlignedShapes(coordinate.y, currentDimensions.y, targetDimensions.y, alignment.y);
    const z = mapAxisBetweenAlignedShapes(coordinate.z, currentDimensions.z, targetDimensions.z, alignment.z);

    if (x === null || y === null || z === null) {
        return null;
    }

    return { x, y, z };
}

function mapAxisBetweenAlignedShapes(currentCoordinate, currentSize, targetSize, alignment) {
    const currentOrigin = getAlignedAxisOrigin(currentSize, alignment);
    const targetOrigin = getAlignedAxisOrigin(targetSize, alignment);
    const worldCoordinate = currentCoordinate + currentOrigin;
    const targetCoordinate = worldCoordinate - targetOrigin;

    if (targetCoordinate < -0.5 || targetCoordinate > targetSize - 0.5) {
        return null;
    }

    return clampInteger(Math.round(targetCoordinate), 0, targetSize - 1);
}

function getAlignedAxisOrigin(size, alignment) {
    switch (alignment) {
        case "min":
            return 0;
        case "max":
            return -(size - 1);
        case "center":
        default:
            return -(size - 1) / 2;
    }
}

function coordinateKey(coordinate) {
    return `${coordinate.x}|${coordinate.y}|${coordinate.z}`;
}

function sceneSnapshotToConfig(sceneSnapshot, overrides = {}) {
    const dimensions = overrides.dimensions ?? sceneSnapshot.dimensions;
    const alignment = overrides.alignment ?? { x: "center", y: "center", z: "center" };
    const cornerColors = sceneSnapshot.cornerColors ?? {};

    return {
        primitive: VOXEL_PRIMITIVES.includes(sceneSnapshot.primitive) ? sceneSnapshot.primitive : "cube",
        blendMode: BLEND_MODES.includes(sceneSnapshot.blendMode) ? sceneSnapshot.blendMode : "rgb",
        colorOverrides: overrides.colorOverrides ?? null,
        showAxes: sceneSnapshot.showAxes !== false,
        showLabels: sceneSnapshot.showLabels === true,
        dimensions: { ...dimensions },
        alignment,
        corners: listUniqueCorners(dimensions).map((corner) => ({
            position: { ...corner.position },
            color: cornerColors[corner.key] ?? corner.defaultColor
        }))
    };
}

function applyPresetRecord(preset) {
    state.blendMode = BLEND_MODES.includes(preset.scene.blendMode) ? preset.scene.blendMode : "rgb";
    state.primitive = VOXEL_PRIMITIVES.includes(preset.scene.primitive) ? preset.scene.primitive : "cube";
    state.showAxes = preset.scene.showAxes !== false;
    state.showLabels = preset.scene.showLabels === true;
    state.dimensions = {
        x: clampInteger(preset.scene.dimensions?.x ?? 5, MIN_DIMENSION, MAX_DIMENSION),
        y: clampInteger(preset.scene.dimensions?.y ?? 5, MIN_DIMENSION, MAX_DIMENSION),
        z: clampInteger(preset.scene.dimensions?.z ?? 5, MIN_DIMENSION, MAX_DIMENSION)
    };
    state.view = {
        azimuth: normalizeDegrees(preset.scene.view?.azimuth ?? 45),
        elevation: clamp(preset.scene.view?.elevation ?? 35.26, -89, 89),
        zoom: clamp(preset.scene.view?.zoom ?? 1, 0.2, 6)
    };
    state.cornerColors = { ...(preset.scene.cornerColors ?? {}) };
    syncCornerColorsToDimensions();
    state.probe = {
        x: clampInteger(state.probe.x, 0, state.dimensions.x - 1),
        y: clampInteger(state.probe.y, 0, state.dimensions.y - 1),
        z: clampInteger(state.probe.z, 0, state.dimensions.z - 1)
    };
    state.selectedPresetId = preset.id;
    state.presetDraftName = preset.name;
}

function createPresetRecord(name, existingPreset) {
    const now = new Date().toISOString();
    return {
        id: existingPreset?.id ?? createId("preset"),
        name,
        createdAt: existingPreset?.createdAt ?? now,
        updatedAt: now,
        scene: captureCurrentSceneForPreset()
    };
}

function captureCurrentSceneForPreset() {
    const cornerColors = {};
    listUniqueCorners(state.dimensions).forEach((corner) => {
        cornerColors[corner.key] = state.cornerColors[corner.key] ?? corner.defaultColor;
    });

    return {
        blendMode: state.blendMode,
        primitive: state.primitive,
        showAxes: state.showAxes,
        showLabels: state.showLabels,
        dimensions: { ...state.dimensions },
        view: { ...state.view },
        cornerColors
    };
}

function createDefaultTransitionDraft() {
    const fromPresetId = state.presets[0]?.id ?? "";
    const toPresetId = state.presets[1]?.id ?? fromPresetId;
    return {
        name: deriveNextTransitionName(),
        fromPresetId,
        toPresetId,
        durationMs: 1200,
        fps: 12,
        viewDelta: {
            azimuth: 0,
            elevation: 0,
            zoom: 0
        },
        alignment: {
            x: "min",
            y: "min",
            z: "min"
        }
    };
}

function createTransitionDraftFromRecord(record) {
    return {
        name: record.name,
        fromPresetId: record.fromPresetId,
        toPresetId: record.toPresetId,
        durationMs: record.durationMs,
        fps: record.fps,
        viewDelta: { ...record.viewDelta },
        alignment: { ...record.alignment }
    };
}

function createTransitionRecord(draft, existingRecord) {
    const now = new Date().toISOString();
    return {
        id: existingRecord?.id ?? createId("transition"),
        name: (draft.name || deriveNextTransitionName()).trim(),
        createdAt: existingRecord?.createdAt ?? now,
        updatedAt: now,
        fromPresetId: draft.fromPresetId,
        toPresetId: draft.toPresetId,
        durationMs: clampInteger(draft.durationMs, 100, 30000),
        fps: clampInteger(draft.fps, 1, 60),
        viewDelta: {
            azimuth: Number(draft.viewDelta.azimuth) || 0,
            elevation: Number(draft.viewDelta.elevation) || 0,
            zoom: Number(draft.viewDelta.zoom) || 0
        },
        alignment: {
            x: ALIGNMENT_OPTIONS.includes(draft.alignment.x) ? draft.alignment.x : "min",
            y: ALIGNMENT_OPTIONS.includes(draft.alignment.y) ? draft.alignment.y : "min",
            z: ALIGNMENT_OPTIONS.includes(draft.alignment.z) ? draft.alignment.z : "min"
        }
    };
}

function ensureTransitionDraftPresetIds() {
    if (state.transitionDraft.fromPresetId && state.presets.some((preset) => preset.id === state.transitionDraft.fromPresetId)) {
        return;
    }

    state.transitionDraft = createDefaultTransitionDraft();
}

function syncFormFromState() {
    setSelectValue("primitive", state.primitive, VOXEL_PRIMITIVES);
    setSelectValue("blend-mode", state.blendMode, BLEND_MODES);
    setNumberInputValue("dimension-x", state.dimensions.x, MIN_DIMENSION, MAX_DIMENSION);
    setNumberInputValue("dimension-y", state.dimensions.y, MIN_DIMENSION, MAX_DIMENSION);
    setNumberInputValue("dimension-z", state.dimensions.z, MIN_DIMENSION, MAX_DIMENSION);
    setNumberInputValue("probe-x", state.probe.x, 0, state.dimensions.x - 1);
    setNumberInputValue("probe-y", state.probe.y, 0, state.dimensions.y - 1);
    setNumberInputValue("probe-z", state.probe.z, 0, state.dimensions.z - 1);
    axesToggle.checked = state.showAxes;
    labelToggle.checked = state.showLabels;

    renderCornerControls();
    syncViewInputs();
    syncPresetControls();
    syncTransitionControls();
    syncSequenceControls();
    syncDataControls();
    syncProbeReadout();

    const uniqueCornerCount = listUniqueCorners(state.dimensions).length;
    titleNode.textContent = `${state.dimensions.x}x${state.dimensions.y}x${state.dimensions.z} corner-colored voxels`;
    copyNode.textContent = [
        `${PRIMITIVE_LABELS[state.primitive]} glyphs are filling the current voxel cells.`,
        `${BLEND_MODE_LABELS[state.blendMode]} blending is active while corner inputs remain standard hex colors.`,
        state.showAxes ? "Axes and ticks are visible." : "Axes and ticks are hidden.",
        playback
            ? "Playback is stepping through the current transition chain."
            : state.showLabels
                ? "Hex labels appear only on exposed faces currently facing the camera."
                : "Enable labels to place each voxel's hex code on a currently visible face.",
        `${uniqueCornerCount} unique corner control${uniqueCornerCount === 1 ? "" : "s"} for the current dimensions.`
    ].join(" ");
}

function syncPresetControls() {
    const selectedPreset = getSelectedPreset();
    presetSelect.innerHTML = state.presets.length === 0
        ? '<option value="">No presets saved yet</option>'
        : state.presets
            .map((preset) => `<option value="${preset.id}">${escapeHtml(preset.name)} · ${formatPresetDate(preset.updatedAt)}</option>`)
            .join("");

    presetSelect.value = selectedPreset?.id ?? "";
    if (!selectedPreset && !state.presetDraftName.trim()) {
        state.presetDraftName = deriveNextPresetName();
    }

    presetNameInput.value = state.presetDraftName;
    presetSummary.textContent = state.presets.length === 0
        ? "Store named scene states in your browser and restore them later."
        : `${state.presets.length} preset${state.presets.length === 1 ? "" : "s"} stored in this browser.`;

    presetOverwriteButton.disabled = !selectedPreset;
    presetLoadButton.disabled = !selectedPreset;
    presetDeleteButton.disabled = !selectedPreset;
}

function syncTransitionControls() {
    const selectedTransition = getSelectedTransition();
    const presetOptions = state.presets.length === 0
        ? '<option value="">Save at least one preset first</option>'
        : state.presets.map((preset) => `<option value="${preset.id}">${escapeHtml(preset.name)}</option>`).join("");

    setNamedSelectHtml("transition-from", presetOptions);
    setNamedSelectHtml("transition-to", presetOptions);
    setNamedSelectValue("transition-from", state.transitionDraft.fromPresetId);
    setNamedSelectValue("transition-to", state.transitionDraft.toPresetId);

    transitionSelect.innerHTML = state.transitions.length === 0
        ? '<option value="">No transitions saved yet</option>'
        : state.transitions
            .map((transition) => `<option value="${transition.id}">${escapeHtml(transition.name)} · ${formatPresetDate(transition.updatedAt)}</option>`)
            .join("");
    transitionSelect.value = selectedTransition?.id ?? "";

    transitionNameInput.value = state.transitionDraft.name;
    setNumberInputValue("transition-duration", state.transitionDraft.durationMs, 100, 30000);
    setNumberInputValue("transition-fps", state.transitionDraft.fps, 1, 60);
    setFloatInputValue("transition-azimuth", state.transitionDraft.viewDelta.azimuth, -720, 720, 2);
    setFloatInputValue("transition-elevation", state.transitionDraft.viewDelta.elevation, -180, 180, 2);
    setFloatInputValue("transition-zoom", state.transitionDraft.viewDelta.zoom, -5, 5, 2);
    setNamedSelectValue("transition-align-x", state.transitionDraft.alignment.x);
    setNamedSelectValue("transition-align-y", state.transitionDraft.alignment.y);
    setNamedSelectValue("transition-align-z", state.transitionDraft.alignment.z);

    transitionSummary.textContent = state.transitions.length === 0
        ? "Define discrete preset-to-preset steps with synchronized dimension growth."
        : `${state.transitions.length} saved transition${state.transitions.length === 1 ? "" : "s"}.`;

    const canOperate = state.presets.length >= 1;
    const canSaveTransition = state.presets.length >= 2;
    transitionSaveButton.disabled = !canSaveTransition;
    transitionOverwriteButton.disabled = !selectedTransition || !canSaveTransition;
    transitionDeleteButton.disabled = !selectedTransition;
    transitionPreviewButton.disabled = !selectedTransition;
    transitionAddSequenceButton.disabled = !selectedTransition;

    if (!canOperate) {
        transitionNameInput.value = "Save presets first";
    }
}

function syncSequenceControls() {
    const resolvedItems = state.sequenceTransitionIds
        .map((id) => state.transitions.find((transition) => transition.id === id))
        .filter(Boolean);

    sequenceSelect.innerHTML = resolvedItems.length === 0
        ? '<option value="">No sequence items yet</option>'
        : resolvedItems
            .map((transition, index) => `<option value="${transition.id}">${index + 1}. ${escapeHtml(transition.name)}</option>`)
            .join("");

    if (resolvedItems.length > 0) {
        state.selectedSequenceIndex = clampInteger(state.selectedSequenceIndex, 0, resolvedItems.length - 1);
        sequenceSelect.selectedIndex = state.selectedSequenceIndex;
    } else {
        state.selectedSequenceIndex = 0;
    }

    sequenceSummary.textContent = playback
        ? `Playing ${playback.items.length} transition${playback.items.length === 1 ? "" : "s"} as a discrete chain.`
        : resolvedItems.length === 0
            ? "Chain saved transitions here to build longer discrete animations."
            : `${resolvedItems.length} transition${resolvedItems.length === 1 ? "" : "s"} in the current chain.`;

    const hasSelection = resolvedItems.length > 0;
    sequenceUpButton.disabled = !hasSelection || state.selectedSequenceIndex === 0 || Boolean(playback);
    sequenceDownButton.disabled = !hasSelection || state.selectedSequenceIndex === resolvedItems.length - 1 || Boolean(playback);
    sequenceRemoveButton.disabled = !hasSelection || Boolean(playback);
    sequenceClearButton.disabled = resolvedItems.length === 0 || Boolean(playback);
    sequencePlayButton.disabled = resolvedItems.length === 0 || Boolean(playback);
    sequenceStopButton.disabled = !playback;
}

function syncDataControls() {
    dataSummary.textContent = [
        `${state.presets.length} preset${state.presets.length === 1 ? "" : "s"}`,
        `${state.transitions.length} transition${state.transitions.length === 1 ? "" : "s"}`,
        `${state.sequenceTransitionIds.length} sequence step${state.sequenceTransitionIds.length === 1 ? "" : "s"}`
    ].join(" · ");
}

function renderCornerControls() {
    const corners = listUniqueCorners(state.dimensions);
    cornerSummary.textContent = `Showing only unique corners for ${state.dimensions.x}x${state.dimensions.y}x${state.dimensions.z}.`;
    cornerGrid.innerHTML = corners
        .map((corner) => {
            const color = state.cornerColors[corner.key] ?? corner.defaultColor;
            const models = describeColorModels(color);
            return `
                <label class="corner-card" data-corner-key="${corner.key}">
                    <span class="corner-card__title">${corner.label}</span>
                    <span class="corner-card__coord">${formatCoordinate(corner.position)}</span>
                    <input type="color" name="corner-${corner.key}" value="${color}" />
                    <span class="corner-card__hex">${models.hex}</span>
                    <div class="model-list">
                        <span class="model-row corner-rgb">${formatRgb(models.rgb)}</span>
                        <span class="model-row corner-hsl">${formatHsl(models.hsl)}</span>
                        <span class="model-row corner-oklch">${formatOklch(models.oklch)}</span>
                    </div>
                </label>
            `;
        })
        .join("");
}

function updateCornerEducationCard(key) {
    const card = cornerGrid.querySelector(`[data-corner-key="${key}"]`);
    if (!(card instanceof HTMLElement)) {
        return;
    }

    const models = describeColorModels(state.cornerColors[key] ?? "#FFFFFF");
    const hexNode = card.querySelector(".corner-card__hex");
    const rgbNode = card.querySelector(".corner-rgb");
    const hslNode = card.querySelector(".corner-hsl");
    const oklchNode = card.querySelector(".corner-oklch");

    if (hexNode instanceof HTMLElement) {
        hexNode.textContent = models.hex;
    }
    if (rgbNode instanceof HTMLElement) {
        rgbNode.textContent = formatRgb(models.rgb);
    }
    if (hslNode instanceof HTMLElement) {
        hslNode.textContent = formatHsl(models.hsl);
    }
    if (oklchNode instanceof HTMLElement) {
        oklchNode.textContent = formatOklch(models.oklch);
    }
}

function syncViewInputs() {
    setFloatInputValue("view-azimuth", state.view.azimuth, 0, 360, 2);
    setFloatInputValue("view-elevation", state.view.elevation, -89, 89, 2);
    setFloatInputValue("view-zoom", state.view.zoom, 0.2, 6, 2);
}

function syncProbeReadout() {
    const sample = sampleVoxelColor(getSceneConfig(), state.probe);
    probeChip.style.background = sample.hex;
    probeHex.textContent = sample.hex;
    probeRgb.textContent = `${formatRgb(sample.rgb)} at ${formatCoordinate(sample.coordinate)}`;
    probeHsl.textContent = formatHsl(sample.hsl);
    probeOklch.textContent = formatOklch(sample.oklch);
}

function exportSceneDataToTextarea() {
    dataJsonTextarea.value = serializeSceneData();
    dataJsonTextarea.focus();
    dataJsonTextarea.select();
    syncDataControls();
}

async function copySceneDataToClipboard() {
    const serialized = serializeSceneData();
    dataJsonTextarea.value = serialized;

    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(serialized);
            dataSummary.textContent = "Scene data copied to clipboard.";
            return;
        } catch {
            // Fall through to select text in the textarea.
        }
    }

    dataJsonTextarea.focus();
    dataJsonTextarea.select();
    dataSummary.textContent = "Scene data selected. Copy it from the textarea.";
}

function importSceneDataFromTextarea() {
    stopPlayback();

    try {
        const payload = JSON.parse(dataJsonTextarea.value);
        if (!payload || typeof payload !== "object") {
            throw new Error("JSON payload must be an object.");
        }

        const presets = Array.isArray(payload.presets) ? payload.presets.filter(isValidPresetRecord) : [];
        const transitions = Array.isArray(payload.transitions) ? payload.transitions.filter(isValidTransitionRecord) : [];
        const transitionIds = new Set(transitions.map((transition) => transition.id));
        const sequence = Array.isArray(payload.sequenceTransitionIds)
            ? payload.sequenceTransitionIds.filter((id) => typeof id === "string" && transitionIds.has(id))
            : [];

        state.presets = sortByUpdatedDesc(presets);
        state.transitions = sortByUpdatedDesc(transitions);
        state.sequenceTransitionIds = sequence;
        state.selectedPresetId = state.presets[0]?.id ?? "";
        state.presetDraftName = state.presets[0]?.name ?? deriveNextPresetName();
        state.selectedTransitionId = state.transitions[0]?.id ?? "";
        state.transitionDraft = state.transitions[0]
            ? createTransitionDraftFromRecord(state.transitions[0])
            : createDefaultTransitionDraft();
        state.selectedSequenceIndex = 0;

        persistStoredArray(PRESET_STORAGE_KEY, state.presets);
        persistStoredArray(TRANSITION_STORAGE_KEY, state.transitions);
        persistStoredArray(SEQUENCE_STORAGE_KEY, state.sequenceTransitionIds);

        syncFormFromState();
        pushStateToScene();
        dataSummary.textContent = "Scene data imported.";
    } catch (error) {
        dataSummary.textContent = `Import failed: ${error instanceof Error ? error.message : "Invalid JSON."}`;
    }
}

function serializeSceneData() {
    return JSON.stringify(
        {
            version: 1,
            exportedAt: new Date().toISOString(),
            presets: state.presets,
            transitions: state.transitions,
            sequenceTransitionIds: state.sequenceTransitionIds
        },
        null,
        2
    );
}

function pushStateToScene() {
    scene.setConfig(getSceneConfig());
    scene.setView(state.view);
    syncProbeReadout();
}

function getSceneConfig() {
    return {
        primitive: state.primitive,
        blendMode: state.blendMode,
        showAxes: state.showAxes,
        showLabels: state.showLabels,
        dimensions: { ...state.dimensions },
        corners: listUniqueCorners(state.dimensions).map((corner) => ({
            position: { ...corner.position },
            color: state.cornerColors[corner.key] ?? corner.defaultColor
        }))
    };
}

function getSelectedPreset() {
    return state.presets.find((preset) => preset.id === state.selectedPresetId);
}

function getSelectedTransition() {
    return state.transitions.find((transition) => transition.id === state.selectedTransitionId);
}

function getPresetDraftName() {
    const trimmed = presetNameInput.value.trim();
    return trimmed || deriveNextPresetName();
}

function captureCornerColorsFromInputs() {
    listUniqueCorners(state.dimensions).forEach((corner) => {
        state.cornerColors[corner.key] = getColorInputValue(`corner-${corner.key}`, state.cornerColors[corner.key] ?? corner.defaultColor);
    });
}

function syncCornerColorsToDimensions() {
    listUniqueCorners(state.dimensions).forEach((corner) => {
        if (!state.cornerColors[corner.key]) {
            state.cornerColors[corner.key] = corner.defaultColor;
        }
    });
}

function loadStoredArray(storageKey, validator, sorter = null) {
    if (typeof window === "undefined" || !window.localStorage) {
        return [];
    }

    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }

        const filtered = parsed.filter(validator);
        return sorter ? sorter(filtered) : filtered;
    } catch {
        return [];
    }
}

function persistStoredArray(storageKey, values) {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
        // Ignore storage issues and keep the app interactive.
    }
}

function isValidPresetRecord(value) {
    return Boolean(
        value &&
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        value.scene &&
        typeof value.scene === "object"
    );
}

function isValidTransitionRecord(value) {
    return Boolean(
        value &&
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.fromPresetId === "string" &&
        typeof value.toPresetId === "string"
    );
}

function sortByUpdatedDesc(items) {
    return [...items].sort((left, right) => {
        const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? 0);
        const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? 0);
        return rightTime - leftTime;
    });
}

function createId(prefix) {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function deriveNextPresetName() {
    return `Preset ${state.presets.length + 1}`;
}

function deriveNextTransitionName() {
    return `Transition ${state.transitions.length + 1}`;
}

function formatPresetDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "unsaved";
    }

    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function setNamedSelectOptions(name, values, labels) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLSelectElement)) {
        return;
    }

    input.innerHTML = values.map((value) => `<option value="${value}">${labels[value] ?? value}</option>`).join("");
}

function setNamedSelectHtml(name, html) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLSelectElement)) {
        return;
    }

    input.innerHTML = html;
}

function setNamedSelectValue(name, value) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLSelectElement)) {
        return;
    }

    input.value = value;
}

function getSelectValue(name, fallback) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLSelectElement)) {
        return fallback;
    }

    return input.value || fallback;
}

function getNumberInputValue(name, fallback) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLInputElement)) {
        return fallback;
    }

    const parsed = Number.parseInt(input.value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getFloatInputValue(name, fallback) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLInputElement)) {
        return fallback;
    }

    const parsed = Number.parseFloat(input.value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getColorInputValue(name, fallback) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLInputElement)) {
        return fallback;
    }

    return /^#[0-9a-f]{6}$/i.test(input.value) ? input.value.toUpperCase() : fallback;
}

function getBlendModeValue(name, fallback) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLSelectElement)) {
        return fallback;
    }

    return BLEND_MODES.includes(input.value) ? input.value : fallback;
}

function getPrimitiveValue(name, fallback) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLSelectElement)) {
        return fallback;
    }

    return VOXEL_PRIMITIVES.includes(input.value) ? input.value : fallback;
}

function getAlignmentValue(name, fallback) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLSelectElement)) {
        return fallback;
    }

    return ALIGNMENT_OPTIONS.includes(input.value) ? input.value : fallback;
}

function setNumberInputValue(name, value, min, max) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLInputElement)) {
        return;
    }

    input.min = String(min);
    input.max = String(max);
    input.value = String(clampInteger(value, min, max));
}

function setFloatInputValue(name, value, min, max, digits) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLInputElement)) {
        return;
    }

    input.min = String(min);
    input.max = String(max);
    input.value = String(roundTo(clamp(value, min, max), digits));
}

function setSelectValue(name, value, options) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLSelectElement)) {
        return;
    }

    input.value = options.includes(value) ? value : options[0];
}

function clampInteger(value, min, max) {
    return Math.min(max, Math.max(min, Math.round(value)));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value) {
    return ((Number(value) % 360) + 360) % 360;
}

function lerp(left, right, t) {
    return left + (right - left) * t;
}

function lerpDegrees(start, end, t) {
    const delta = ((((end - start) % 360) + 540) % 360) - 180;
    return normalizeDegrees(start + delta * t);
}

function interpolateAzimuthWithSpin(start, end, spinDelta, t) {
    const baseDelta = ((((end - start) % 360) + 540) % 360) - 180;
    const totalDelta = baseDelta + (Number(spinDelta) || 0);
    return normalizeDegrees(start + totalDelta * t);
}

function roundTo(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function formatCoordinate(position) {
    return `(${position.x}, ${position.y}, ${position.z})`;
}

function formatRgb(rgb) {
    return `RGB ${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

function formatHsl(hsl) {
    return `HSL ${hsl.h}deg, ${hsl.s}%, ${hsl.l}%`;
}

function formatOklch(oklch) {
    return `OKLCH L ${oklch.l}, C ${oklch.c}, H ${oklch.h}deg`;
}
