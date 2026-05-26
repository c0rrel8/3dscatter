import {
    BoxGeometry,
    CanvasTexture,
    DodecahedronGeometry,
    DoubleSide,
    EdgesGeometry,
    Group,
    IcosahedronGeometry,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    OctahedronGeometry,
    OrthographicCamera,
    PlaneGeometry,
    Scene,
    SphereGeometry,
    Sprite,
    SpriteMaterial,
    TetrahedronGeometry,
    Vector3,
    WebGLRenderer
} from "three";
import { OrbitControls } from "../node_modules/three/examples/jsm/controls/OrbitControls.js";

const STEP = 1;
const VOXEL_SIZE = 0.72;
const AXIS_THICKNESS = 0.055;
const TICK_LENGTH = 0.22;
const TICK_THICKNESS = 0.045;
const AXIS_EXTENSION = 0.8;
const LABEL_OFFSET = 0.03;
const UNIT_Z = new Vector3(0, 0, 1);
const AXIS_COLORS = {
    x: "#ff4d4d",
    y: "#f2f2f2",
    z: "#4d7dff"
};
export const BLEND_MODES = ["rgb", "hsl", "oklch"];
export const VOXEL_PRIMITIVES = ["cube", "sphere", "octahedron", "tetrahedron", "icosahedron", "dodecahedron"];
export const ALIGNMENT_OPTIONS = ["min", "center", "max"];
const DEFAULT_CORNER_COLOR = "#FFFFFF";
const FACE_DEFINITIONS = [
    { normal: new Vector3(-1, 0, 0), boundary: (coord) => coord.x === 0 },
    { normal: new Vector3(1, 0, 0), boundary: (coord, dimensions) => coord.x === dimensions.x - 1 },
    { normal: new Vector3(0, -1, 0), boundary: (coord) => coord.y === 0 },
    { normal: new Vector3(0, 1, 0), boundary: (coord, dimensions) => coord.y === dimensions.y - 1 },
    { normal: new Vector3(0, 0, -1), boundary: (coord) => coord.z === 0 },
    { normal: new Vector3(0, 0, 1), boundary: (coord, dimensions) => coord.z === dimensions.z - 1 }
];

export function listUniqueCorners(rawDimensions) {
    const dimensions = normalizeDimensions(rawDimensions);
    const max = {
        x: dimensions.x - 1,
        y: dimensions.y - 1,
        z: dimensions.z - 1
    };
    const corners = [];
    const seen = new Set();

    [0, 1].forEach((xb) => {
        [0, 1].forEach((yb) => {
            [0, 1].forEach((zb) => {
                const position = {
                    x: xb === 1 ? max.x : 0,
                    y: yb === 1 ? max.y : 0,
                    z: zb === 1 ? max.z : 0
                };
                const key = positionKey(position);
                if (seen.has(key)) {
                    return;
                }

                seen.add(key);
                corners.push({
                    key,
                    position,
                    bits: { x: xb, y: yb, z: zb },
                    label: `Corner ${xb}${yb}${zb}`,
                    defaultColor: DEFAULT_CORNER_COLOR
                });
            });
        });
    });

    return corners.sort(compareCornerPositions);
}

export function describeColorModels(value) {
    const rgb = typeof value === "string" ? hexToRgb(normalizeHexColor(value)) : normalizeRgb(value);
    return createColorSample(rgb);
}

export function sampleVoxelColor(rawConfig, rawCoordinate) {
    const config = normalizeConfig(rawConfig);
    const coordinate = {
        x: clampInteger(rawCoordinate?.x ?? 0, 0, config.dimensions.x - 1),
        y: clampInteger(rawCoordinate?.y ?? 0, 0, config.dimensions.y - 1),
        z: clampInteger(rawCoordinate?.z ?? 0, 0, config.dimensions.z - 1)
    };

    const sample = resolveVoxelColor(coordinate, config);
    return {
        coordinate,
        hex: sample.hex,
        rgb: sample.rgb,
        hsl: sample.hsl,
        oklch: sample.oklch
    };
}

export function mountVoxelScene(canvas, initialConfig, options = {}) {
    const renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
    });
    renderer.setClearColor("#000000", 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.rotateSpeed = 0.78;
    controls.zoomSpeed = 0.9;

    const content = new Group();
    scene.add(content);

    let config = normalizeConfig(initialConfig);
    let voxelRecords = [];
    let animationFrame = 0;

    const notifyViewChange = () => {
        if (typeof options.onViewChange === "function") {
            options.onViewChange(getViewState(camera));
        }
    };

    controls.addEventListener("change", notifyViewChange);

    rebuildScene();
    updateViewport();
    resetView();
    renderFrame();

    window.addEventListener("resize", handleResize);

    return {
        destroy: () => {
            window.removeEventListener("resize", handleResize);
            window.cancelAnimationFrame(animationFrame);
            controls.removeEventListener("change", notifyViewChange);
            controls.dispose();
            disposeGroup(content);
            renderer.dispose();
        },
        getView() {
            return getViewState(camera);
        },
        resetView,
        setConfig(nextConfig) {
            config = normalizeConfig(nextConfig);
            rebuildScene();
            updateViewport();
            notifyViewChange();
        },
        setView(nextView) {
            applyViewState(camera, controls, nextView);
            notifyViewChange();
        }
    };

    function handleResize() {
        updateViewport();
    }

    function updateViewport() {
        const width = Math.max(1, canvas.clientWidth || window.innerWidth);
        const height = Math.max(1, canvas.clientHeight || window.innerHeight);
        const aspect = width / height;
        const frustumSize = calculateFrustumSize(config.dimensions);
        const halfHeight = frustumSize / 2;
        const halfWidth = halfHeight * aspect;

        camera.left = -halfWidth;
        camera.right = halfWidth;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.near = 0.1;
        camera.far = 200;
        camera.updateProjectionMatrix();

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
    }

    function resetView() {
        applyViewState(camera, controls, {
            azimuth: 45,
            elevation: 35.26438968,
            zoom: 1,
            distance: calculateOrbitDistance(config.dimensions)
        });
        notifyViewChange();
    }

    function rebuildScene() {
        disposeGroup(content);
        content.clear();
        voxelRecords = [];

        const voxelGeometry = createVoxelGeometry(config.primitive);
        const edgeGeometry = new EdgesGeometry(voxelGeometry);
        const labelGeometry = new PlaneGeometry(VOXEL_SIZE * 0.76, VOXEL_SIZE * 0.26);
        const outlineMaterial = new LineBasicMaterial({
            color: "#11161f",
            transparent: true,
            opacity: 0.92
        });
        const labelMaterialCache = new Map();
        const voxelMaterialCache = new Map();

        for (let x = 0; x < config.dimensions.x; x += 1) {
            for (let y = 0; y < config.dimensions.y; y += 1) {
                for (let z = 0; z < config.dimensions.z; z += 1) {
                    const coordinate = { x, y, z };
                    const position = gridToWorld(coordinate, config.dimensions, config.alignment);
                    const sample = resolveVoxelColor(coordinate, config);
                    const voxelMaterial = getCachedMaterial(voxelMaterialCache, sample.hex, () => new MeshBasicMaterial({ color: sample.hex }));

                    const voxel = new Mesh(voxelGeometry, voxelMaterial);
                    voxel.position.copy(position);
                    content.add(voxel);

                    const outline = new LineSegments(edgeGeometry, outlineMaterial);
                    outline.position.copy(position);
                    content.add(outline);

                    const labelMaterial = getCachedMaterial(labelMaterialCache, sample.hex, () => createLabelMaterial(sample.hex, sample.rgb));
                    const label = new Mesh(labelGeometry, labelMaterial);
                    label.visible = false;
                    content.add(label);

                    voxelRecords.push({
                        coordinate,
                        position,
                        label
                    });
                }
            }
        }

        if (config.showAxes) {
            buildAxes(content, config.dimensions);
        }
    }

    function renderFrame() {
        controls.update();
        updateLabels(voxelRecords, config, camera);
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(renderFrame);
    }
}

function buildAxes(root, dimensions) {
    const axisSpecs = [
        {
            label: "X",
            color: AXIS_COLORS.x,
            axisSize: [Math.max((dimensions.x - 1 + AXIS_EXTENSION) * STEP, 0.2), AXIS_THICKNESS, AXIS_THICKNESS],
            endpoint: gridToWorld({ x: dimensions.x - 1 + AXIS_EXTENSION, y: 0, z: 0 }, dimensions),
            midpoint: gridToWorld({ x: (dimensions.x - 1 + AXIS_EXTENSION) / 2, y: 0, z: 0 }, dimensions),
            labelOffset: new Vector3(0.28, -0.12, -0.18),
            ticks: dimensions.x
        },
        {
            label: "Y",
            color: AXIS_COLORS.y,
            axisSize: [AXIS_THICKNESS, Math.max((dimensions.y - 1 + AXIS_EXTENSION) * STEP, 0.2), AXIS_THICKNESS],
            endpoint: gridToWorld({ x: 0, y: dimensions.y - 1 + AXIS_EXTENSION, z: 0 }, dimensions),
            midpoint: gridToWorld({ x: 0, y: (dimensions.y - 1 + AXIS_EXTENSION) / 2, z: 0 }, dimensions),
            labelOffset: new Vector3(-0.22, 0.24, -0.08),
            ticks: dimensions.y
        },
        {
            label: "Z",
            color: AXIS_COLORS.z,
            axisSize: [AXIS_THICKNESS, AXIS_THICKNESS, Math.max((dimensions.z - 1 + AXIS_EXTENSION) * STEP, 0.2)],
            endpoint: gridToWorld({ x: 0, y: 0, z: dimensions.z - 1 + AXIS_EXTENSION }, dimensions),
            midpoint: gridToWorld({ x: 0, y: 0, z: (dimensions.z - 1 + AXIS_EXTENSION) / 2 }, dimensions),
            labelOffset: new Vector3(-0.08, -0.14, 0.26),
            ticks: dimensions.z
        }
    ];

    axisSpecs.forEach((axis) => {
        const bar = new Mesh(
            new BoxGeometry(...axis.axisSize),
            new MeshBasicMaterial({ color: axis.color })
        );
        bar.position.copy(axis.midpoint);
        root.add(bar);

        for (let tick = 0; tick < axis.ticks; tick += 1) {
            createTicks(axis.label, tick, axis.color, dimensions).forEach((tickMesh) => root.add(tickMesh));
        }

        const label = makeAxisLabel(axis.label, axis.color);
        label.position.copy(axis.endpoint.clone().add(axis.labelOffset));
        root.add(label);
    });

    const originMarker = new Mesh(
        new BoxGeometry(0.12, 0.12, 0.12),
        new MeshBasicMaterial({ color: "#7d8796" })
    );
    originMarker.position.copy(gridToWorld({ x: 0, y: 0, z: 0 }, dimensions));
    root.add(originMarker);
}

function createTicks(axis, tick, color, dimensions) {
    switch (axis) {
        case "X":
            return [
                createBarMesh([TICK_THICKNESS, TICK_LENGTH, TICK_THICKNESS], gridToWorld({ x: tick, y: 0, z: 0 }, dimensions), color),
                createBarMesh([TICK_THICKNESS, TICK_THICKNESS, TICK_LENGTH], gridToWorld({ x: tick, y: 0, z: 0 }, dimensions), color)
            ];
        case "Y":
            return [
                createBarMesh([TICK_LENGTH, TICK_THICKNESS, TICK_THICKNESS], gridToWorld({ x: 0, y: tick, z: 0 }, dimensions), color),
                createBarMesh([TICK_THICKNESS, TICK_THICKNESS, TICK_LENGTH], gridToWorld({ x: 0, y: tick, z: 0 }, dimensions), color)
            ];
        default:
            return [
                createBarMesh([TICK_LENGTH, TICK_THICKNESS, TICK_THICKNESS], gridToWorld({ x: 0, y: 0, z: tick }, dimensions), color),
                createBarMesh([TICK_THICKNESS, TICK_LENGTH, TICK_THICKNESS], gridToWorld({ x: 0, y: 0, z: tick }, dimensions), color)
            ];
    }
}

function createBarMesh(dimensions, position, color) {
    const mesh = new Mesh(new BoxGeometry(...dimensions), new MeshBasicMaterial({ color }));
    mesh.position.copy(position);
    return mesh;
}

function makeAxisLabel(text, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 96;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Unable to create axis label context.");
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = '700 48px "Segoe UI Variable", "Segoe UI", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);
    const material = new SpriteMaterial({ map: texture, transparent: true });
    const sprite = new Sprite(material);
    sprite.scale.set(0.58, 0.35, 1);
    return sprite;
}

function createLabelMaterial(hex, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Unable to create label context.");
    }

    const luminance = (color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722) / 255;
    const darkText = luminance > 0.68;
    const backgroundColor = darkText ? "rgba(255,255,255,0.74)" : "rgba(0,0,0,0.62)";
    const strokeColor = darkText ? "rgba(20,24,31,0.2)" : "rgba(255,255,255,0.18)";

    context.clearRect(0, 0, canvas.width, canvas.height);
    roundRect(context, 6, 12, canvas.width - 12, canvas.height - 24, 18);
    context.fillStyle = backgroundColor;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = strokeColor;
    context.stroke();
    context.fillStyle = darkText ? "#111827" : "#f8fafc";
    context.font = '700 30px "Segoe UI Variable", "Segoe UI", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(hex, canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    return new MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: DoubleSide,
        depthWrite: false
    });
}

function updateLabels(voxelRecords, config, camera) {
    if (!config.showLabels) {
        voxelRecords.forEach((record) => {
            record.label.visible = false;
        });
        return;
    }

    voxelRecords.forEach((record) => {
        const visibleFace = selectVisibleFace(record.coordinate, record.position, config.dimensions, camera.position);
        if (!visibleFace) {
            record.label.visible = false;
            return;
        }

        const faceCenter = record.position.clone().addScaledVector(visibleFace.normal, VOXEL_SIZE / 2 + LABEL_OFFSET);
        record.label.position.copy(faceCenter);
        record.label.quaternion.setFromUnitVectors(UNIT_Z, visibleFace.normal);
        record.label.visible = true;
    });
}

function selectVisibleFace(coordinate, position, dimensions, cameraPosition) {
    let bestFace;
    let bestScore = 0.12;

    FACE_DEFINITIONS.forEach((face) => {
        if (!face.boundary(coordinate, dimensions)) {
            return;
        }

        const faceCenter = position.clone().addScaledVector(face.normal, VOXEL_SIZE / 2);
        const toCamera = cameraPosition.clone().sub(faceCenter).normalize();
        const score = face.normal.dot(toCamera);
        if (score > bestScore) {
            bestFace = face;
            bestScore = score;
        }
    });

    return bestFace;
}

function resolveVoxelColor(coordinate, config) {
    const overrideHex = config.colorOverrides?.[positionKey(coordinate)];
    if (overrideHex) {
        return createColorSample(hexToRgb(overrideHex));
    }

    const max = {
        x: Math.max(0, config.dimensions.x - 1),
        y: Math.max(0, config.dimensions.y - 1),
        z: Math.max(0, config.dimensions.z - 1)
    };
    const tx = max.x === 0 ? 0 : coordinate.x / max.x;
    const ty = max.y === 0 ? 0 : coordinate.y / max.y;
    const tz = max.z === 0 ? 0 : coordinate.z / max.z;

    const corners = {
        c000: getCornerRgb(config, { x: 0, y: 0, z: 0 }),
        c100: getCornerRgb(config, { x: max.x, y: 0, z: 0 }),
        c010: getCornerRgb(config, { x: 0, y: max.y, z: 0 }),
        c110: getCornerRgb(config, { x: max.x, y: max.y, z: 0 }),
        c001: getCornerRgb(config, { x: 0, y: 0, z: max.z }),
        c101: getCornerRgb(config, { x: max.x, y: 0, z: max.z }),
        c011: getCornerRgb(config, { x: 0, y: max.y, z: max.z }),
        c111: getCornerRgb(config, { x: max.x, y: max.y, z: max.z })
    };

    return createColorSample(blendCorners(tx, ty, tz, corners, config.blendMode));
}

function getCornerRgb(config, position) {
    const key = positionKey(position);
    const corner = config.corners.find((item) => item.key === key);
    return corner?.colorRgb ?? { r: 255, g: 255, b: 255 };
}

function blendCorners(fx, fy, fz, corners, blendMode) {
    switch (blendMode) {
        case "hsl":
            return hslToRgb(
                trilinearPolarColor(
                    fx,
                    fy,
                    fz,
                    corners,
                    (rgb) => {
                        const hsl = rgbToHsl(rgb);
                        return {
                            l: hsl.l,
                            u: hsl.s * Math.cos(degreesToRadians(hsl.h)),
                            v: hsl.s * Math.sin(degreesToRadians(hsl.h))
                        };
                    },
                    (value) => ({
                        h: normalizeDegrees(radiansToDegrees(Math.atan2(value.v, value.u))),
                        s: clamp(Math.sqrt(value.u * value.u + value.v * value.v), 0, 1),
                        l: clamp(value.l, 0, 1)
                    })
                )
            );
        case "oklch":
            return oklchToRgb(
                trilinearPolarColor(
                    fx,
                    fy,
                    fz,
                    corners,
                    (rgb) => {
                        const oklch = rgbToOklch(rgb);
                        return {
                            l: oklch.l,
                            u: oklch.c * Math.cos(degreesToRadians(oklch.h)),
                            v: oklch.c * Math.sin(degreesToRadians(oklch.h))
                        };
                    },
                    (value) => ({
                        l: clamp(value.l, 0, 1),
                        c: Math.max(0, Math.sqrt(value.u * value.u + value.v * value.v)),
                        h: normalizeDegrees(radiansToDegrees(Math.atan2(value.v, value.u)))
                    })
                )
            );
        case "rgb":
        default:
            return trilinearRgb(fx, fy, fz, corners);
    }
}

function trilinearRgb(fx, fy, fz, corners) {
    const c00 = lerpRgb(corners.c000, corners.c100, fx);
    const c10 = lerpRgb(corners.c010, corners.c110, fx);
    const c01 = lerpRgb(corners.c001, corners.c101, fx);
    const c11 = lerpRgb(corners.c011, corners.c111, fx);
    const c0 = lerpRgb(c00, c10, fy);
    const c1 = lerpRgb(c01, c11, fy);
    return lerpRgb(c0, c1, fz);
}

function trilinearPolarColor(fx, fy, fz, corners, toCartesian, fromCartesian) {
    const c00 = lerpPolar(toCartesian(corners.c000), toCartesian(corners.c100), fx);
    const c10 = lerpPolar(toCartesian(corners.c010), toCartesian(corners.c110), fx);
    const c01 = lerpPolar(toCartesian(corners.c001), toCartesian(corners.c101), fx);
    const c11 = lerpPolar(toCartesian(corners.c011), toCartesian(corners.c111), fx);
    const c0 = lerpPolar(c00, c10, fy);
    const c1 = lerpPolar(c01, c11, fy);
    return fromCartesian(lerpPolar(c0, c1, fz));
}

function lerpRgb(left, right, t) {
    return {
        r: left.r + (right.r - left.r) * t,
        g: left.g + (right.g - left.g) * t,
        b: left.b + (right.b - left.b) * t
    };
}

function lerpPolar(left, right, t) {
    return {
        l: left.l + (right.l - left.l) * t,
        u: left.u + (right.u - left.u) * t,
        v: left.v + (right.v - left.v) * t
    };
}

function gridToWorld(coordinate, dimensions, alignment = { x: "center", y: "center", z: "center" }) {
    return new Vector3(
        (coordinate.x + getAxisOriginOffset(dimensions.x, alignment.x)) * STEP,
        (coordinate.y + getAxisOriginOffset(dimensions.y, alignment.y)) * STEP,
        (coordinate.z + getAxisOriginOffset(dimensions.z, alignment.z)) * STEP
    );
}

function calculateFrustumSize(dimensions) {
    const largestDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
    return Math.max(8, largestDimension * 2.45);
}

function calculateOrbitDistance(dimensions) {
    return Math.max(8, Math.max(dimensions.x, dimensions.y, dimensions.z) * 2.2);
}

function applyViewState(camera, controls, nextView) {
    const currentDistance = nextView?.distance ?? (camera.position.length() || 1);
    const azimuth = degreesToRadians(normalizeDegrees(nextView?.azimuth ?? 45));
    const elevation = degreesToRadians(clamp(nextView?.elevation ?? 35.26438968, -89, 89));
    const planar = currentDistance * Math.cos(elevation);

    camera.position.set(
        planar * Math.cos(azimuth),
        currentDistance * Math.sin(elevation),
        planar * Math.sin(azimuth)
    );
    camera.zoom = clamp(nextView?.zoom ?? 1, 0.2, 6);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
}

function getViewState(camera) {
    const distance = camera.position.length() || 1;
    const elevation = Math.asin(clamp(camera.position.y / distance, -1, 1));
    const azimuth = Math.atan2(camera.position.z, camera.position.x);

    return {
        azimuth: roundTo(normalizeDegrees(radiansToDegrees(azimuth)), 2),
        elevation: roundTo(radiansToDegrees(elevation), 2),
        zoom: roundTo(camera.zoom, 2),
        distance: roundTo(distance, 4)
    };
}

function normalizeConfig(config) {
    const dimensions = normalizeDimensions(config?.dimensions);
    const requestedCorners = Array.isArray(config?.corners) ? config.corners : [];
    const corners = listUniqueCorners(dimensions).map((corner) => {
        const match = requestedCorners.find((item) => samePosition(item?.position, corner.position));
        const color = normalizeHexColor(match?.color ?? corner.defaultColor);
        return {
            key: corner.key,
            position: corner.position,
            color,
            colorRgb: hexToRgb(color)
        };
    });

    return {
        blendMode: normalizeBlendMode(config?.blendMode),
        primitive: normalizePrimitive(config?.primitive),
        alignment: normalizeAlignment(config?.alignment),
        colorOverrides: normalizeColorOverrides(config?.colorOverrides),
        showAxes: config?.showAxes !== false,
        showLabels: config?.showLabels === true,
        dimensions,
        corners
    };
}

function normalizeDimensions(rawDimensions) {
    return {
        x: clampInteger(rawDimensions?.x ?? 5, 1, 10),
        y: clampInteger(rawDimensions?.y ?? 5, 1, 10),
        z: clampInteger(rawDimensions?.z ?? 5, 1, 10)
    };
}

function normalizeRgb(rgb) {
    return {
        r: clampInteger(rgb?.r ?? 255, 0, 255),
        g: clampInteger(rgb?.g ?? 255, 0, 255),
        b: clampInteger(rgb?.b ?? 255, 0, 255)
    };
}

function positionKey(position) {
    return `${position.x}|${position.y}|${position.z}`;
}

function compareCornerPositions(left, right) {
    if (left.position.z !== right.position.z) {
        return left.position.z - right.position.z;
    }
    if (left.position.y !== right.position.y) {
        return left.position.y - right.position.y;
    }
    return left.position.x - right.position.x;
}

function samePosition(left, right) {
    return left?.x === right.x && left?.y === right.y && left?.z === right.z;
}

function createColorSample(rgb) {
    const rounded = normalizeRgb(rgb);
    return {
        rgb: rounded,
        hex: rgbToHex(rounded),
        hsl: formatHsl(rgbToHsl(rounded)),
        oklch: formatOklch(rgbToOklch(rounded))
    };
}

function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16)
    };
}

function rgbToHex(rgb) {
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function rgbToHsl(rgb) {
    const r = clamp(rgb.r / 255, 0, 1);
    const g = clamp(rgb.g / 255, 0, 1);
    const b = clamp(rgb.b / 255, 0, 1);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const delta = max - min;

    if (delta === 0) {
        return { h: 0, s: 0, l: lightness };
    }

    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    let hue;

    if (max === r) {
        hue = ((g - b) / delta) % 6;
    } else if (max === g) {
        hue = (b - r) / delta + 2;
    } else {
        hue = (r - g) / delta + 4;
    }

    return {
        h: normalizeDegrees(hue * 60),
        s: clamp(saturation, 0, 1),
        l: clamp(lightness, 0, 1)
    };
}

function hslToRgb(hsl) {
    const h = normalizeDegrees(hsl.h);
    const s = clamp(hsl.s, 0, 1);
    const l = clamp(hsl.l, 0, 1);

    if (s === 0) {
        const gray = l * 255;
        return { r: gray, g: gray, b: gray };
    }

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (hp >= 0 && hp < 1) {
        r1 = c;
        g1 = x;
    } else if (hp < 2) {
        r1 = x;
        g1 = c;
    } else if (hp < 3) {
        g1 = c;
        b1 = x;
    } else if (hp < 4) {
        g1 = x;
        b1 = c;
    } else if (hp < 5) {
        r1 = x;
        b1 = c;
    } else {
        r1 = c;
        b1 = x;
    }

    const m = l - c / 2;
    return {
        r: (r1 + m) * 255,
        g: (g1 + m) * 255,
        b: (b1 + m) * 255
    };
}

function rgbToOklch(rgb) {
    return oklabToOklch(rgbToOklab(rgb));
}

function oklchToRgb(oklch) {
    return oklabToRgb(oklchToOklab(oklch));
}

function rgbToOklab(rgb) {
    const linear = {
        r: srgbToLinear(rgb.r / 255),
        g: srgbToLinear(rgb.g / 255),
        b: srgbToLinear(rgb.b / 255)
    };

    const l = Math.cbrt(0.4122214708 * linear.r + 0.5363325363 * linear.g + 0.0514459929 * linear.b);
    const m = Math.cbrt(0.2119034982 * linear.r + 0.6806995451 * linear.g + 0.1073969566 * linear.b);
    const s = Math.cbrt(0.0883024619 * linear.r + 0.2817188376 * linear.g + 0.6299787005 * linear.b);

    return {
        l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    };
}

function oklabToRgb(oklab) {
    const l_ = oklab.l + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
    const m_ = oklab.l - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
    const s_ = oklab.l - 0.0894841775 * oklab.a - 1.291485548 * oklab.b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    return {
        r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255,
        g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * 255,
        b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) * 255
    };
}

function oklabToOklch(oklab) {
    return {
        l: oklab.l,
        c: Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b),
        h: normalizeDegrees(radiansToDegrees(Math.atan2(oklab.b, oklab.a)))
    };
}

function oklchToOklab(oklch) {
    const hue = degreesToRadians(oklch.h);
    return {
        l: clamp(oklch.l, 0, 1),
        a: Math.max(0, oklch.c) * Math.cos(hue),
        b: Math.max(0, oklch.c) * Math.sin(hue)
    };
}

function srgbToLinear(value) {
    const safe = clamp(value, 0, 1);
    return safe <= 0.04045 ? safe / 12.92 : ((safe + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
    const safe = clamp(value, 0, 1);
    return safe <= 0.0031308 ? 12.92 * safe : 1.055 * safe ** (1 / 2.4) - 0.055;
}

function toHex(value) {
    return clampInteger(value, 0, 255).toString(16).toUpperCase().padStart(2, "0");
}

function normalizeHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "#FFFFFF";
}

function normalizeBlendMode(value) {
    const normalized = typeof value === "string" ? value.toLowerCase() : "rgb";
    return BLEND_MODES.includes(normalized) ? normalized : "rgb";
}

function normalizePrimitive(value) {
    const normalized = typeof value === "string" ? value.toLowerCase() : "cube";
    return VOXEL_PRIMITIVES.includes(normalized) ? normalized : "cube";
}

function normalizeAlignment(value) {
    return {
        x: normalizeAlignmentAxis(value?.x),
        y: normalizeAlignmentAxis(value?.y),
        z: normalizeAlignmentAxis(value?.z)
    };
}

function normalizeAlignmentAxis(value) {
    const normalized = typeof value === "string" ? value.toLowerCase() : "center";
    return ALIGNMENT_OPTIONS.includes(normalized) ? normalized : "center";
}

function normalizeColorOverrides(value) {
    if (!value || typeof value !== "object") {
        return null;
    }

    const normalized = {};
    Object.entries(value).forEach(([key, color]) => {
        normalized[key] = normalizeHexColor(color);
    });
    return normalized;
}

function getAxisOriginOffset(size, alignment) {
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

function createVoxelGeometry(primitive) {
    switch (primitive) {
        case "sphere":
            return new SphereGeometry(VOXEL_SIZE * 0.5, 20, 12);
        case "octahedron":
            return new OctahedronGeometry(VOXEL_SIZE * 0.57, 0);
        case "tetrahedron":
            return new TetrahedronGeometry(VOXEL_SIZE * 0.66, 0);
        case "icosahedron":
            return new IcosahedronGeometry(VOXEL_SIZE * 0.56, 0);
        case "dodecahedron":
            return new DodecahedronGeometry(VOXEL_SIZE * 0.53, 0);
        case "cube":
        default:
            return new BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    }
}

function clampInteger(value, min, max) {
    return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value) {
    const normalized = Number(value) || 0;
    return ((normalized % 360) + 360) % 360;
}

function degreesToRadians(value) {
    return (value * Math.PI) / 180;
}

function radiansToDegrees(value) {
    return (value * 180) / Math.PI;
}

function roundTo(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function formatHsl(hsl) {
    return {
        h: roundTo(hsl.h, 1),
        s: roundTo(hsl.s * 100, 1),
        l: roundTo(hsl.l * 100, 1)
    };
}

function formatOklch(oklch) {
    return {
        l: roundTo(oklch.l, 4),
        c: roundTo(oklch.c, 4),
        h: roundTo(oklch.h, 1)
    };
}

function getCachedMaterial(cache, key, createMaterial) {
    const existing = cache.get(key);
    if (existing) {
        return existing;
    }

    const material = createMaterial();
    cache.set(key, material);
    return material;
}

function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
}

function disposeGroup(group) {
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();
    const disposedTextures = new Set();

    group.traverse((child) => {
        const renderObject = child;
        if (renderObject.geometry && !disposedGeometries.has(renderObject.geometry)) {
            renderObject.geometry.dispose();
            disposedGeometries.add(renderObject.geometry);
        }

        const materials = Array.isArray(renderObject.material) ? renderObject.material : renderObject.material ? [renderObject.material] : [];
        materials.forEach((material) => {
            if (material.map && !disposedTextures.has(material.map)) {
                material.map.dispose();
                disposedTextures.add(material.map);
            }

            if (!disposedMaterials.has(material)) {
                material.dispose();
                disposedMaterials.add(material);
            }
        });
    });
}
