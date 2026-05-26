import {
    WebGLProjectedAxis,
    WebGLProjectedPoint,
    WebGLSceneAppearance,
    WebGLSceneAxisInput,
    WebGLSceneBounds,
    WebGLSceneCamera,
    WebGLSceneFrameInput,
    WebGLSceneHitResult,
    WebGLScenePointInput,
    WebGLSceneViewport,
    WebGLVec3,
    WebGLVec4,
    WebGLPreparedScene
} from "./webglScene.types";

const DEFAULT_APPEARANCE: WebGLSceneAppearance = {
    backgroundColor: "#0b1220",
    pointColor: "#38bdf8",
    axisXColor: "#ef4444",
    axisYColor: "#22c55e",
    axisZColor: "#3b82f6",
    pointOpacity: 0.88,
    selectedOpacity: 1,
    highlightOpacity: 1,
    axisOpacity: 0.7,
    basePointSize: 5,
    sizeScale: 3.25,
    sceneScale: 0.44
};

const POINT_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec4 aColor;
attribute float aPointSize;
uniform float uYaw;
uniform float uPitch;
uniform float uDistance;
uniform float uSceneScale;
uniform float uPointScale;
varying vec4 vColor;

void main() {
    float cosYaw = cos(uYaw);
    float sinYaw = sin(uYaw);
    float cosPitch = cos(uPitch);
    float sinPitch = sin(uPitch);

    float yawX = aPosition.x * cosYaw - aPosition.z * sinYaw;
    float yawZ = aPosition.x * sinYaw + aPosition.z * cosYaw;
    float pitchY = aPosition.y * cosPitch - yawZ * sinPitch;
    float pitchZ = aPosition.y * sinPitch + yawZ * cosPitch;

    float depth = uDistance - pitchZ;
    float perspective = uDistance / max(depth, 0.3);
    gl_Position = vec4(yawX * perspective * uSceneScale, pitchY * perspective * uSceneScale, 0.0, 1.0);
    gl_PointSize = max(2.5, aPointSize * perspective * uPointScale);
    vColor = aColor;
}
`;

const AXIS_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec4 aColor;
uniform float uYaw;
uniform float uPitch;
uniform float uDistance;
uniform float uSceneScale;
varying vec4 vColor;

void main() {
    float cosYaw = cos(uYaw);
    float sinYaw = sin(uYaw);
    float cosPitch = cos(uPitch);
    float sinPitch = sin(uPitch);

    float yawX = aPosition.x * cosYaw - aPosition.z * sinYaw;
    float yawZ = aPosition.x * sinYaw + aPosition.z * cosYaw;
    float pitchY = aPosition.y * cosPitch - yawZ * sinPitch;
    float pitchZ = aPosition.y * sinPitch + yawZ * cosPitch;

    float depth = uDistance - pitchZ;
    float perspective = uDistance / max(depth, 0.3);
    gl_Position = vec4(yawX * perspective * uSceneScale, pitchY * perspective * uSceneScale, 0.0, 1.0);
    vColor = aColor;
}
`;

const POINT_FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;

void main() {
    vec2 centered = gl_PointCoord * 2.0 - 1.0;
    float radius = dot(centered, centered);
    if (radius > 1.0) {
        discard;
    }

    float alpha = 1.0 - smoothstep(0.7, 1.0, radius);
    gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
}
`;

const AXIS_FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;

void main() {
    gl_FragColor = vColor;
}
`;

let colorContext: CanvasRenderingContext2D | null = null;

export function calculateSceneBounds(points: WebGLScenePointInput[]): WebGLSceneBounds {
    if (points.length === 0) {
        return { x: [-1, 1], y: [-1, 1], z: [-1, 1] };
    }

    return {
        x: expandRange(extent(points.map((point) => point.position[0]))),
        y: expandRange(extent(points.map((point) => point.position[1]))),
        z: expandRange(extent(points.map((point) => point.position[2])))
    };
}

export function resolveAppearance(overrides?: Partial<WebGLSceneAppearance>): WebGLSceneAppearance {
    return { ...DEFAULT_APPEARANCE, ...overrides };
}

export function buildDefaultAxes(): WebGLSceneAxisInput[] {
    return [
        { label: "X", start: [-1, 0, 0], end: [1, 0, 0], color: DEFAULT_APPEARANCE.axisXColor },
        { label: "Y", start: [0, -1, 0], end: [0, 1, 0], color: DEFAULT_APPEARANCE.axisYColor },
        { label: "Z", start: [0, 0, -1], end: [0, 0, 1], color: DEFAULT_APPEARANCE.axisZColor }
    ];
}

export function projectScenePoint(
    point: WebGLScenePointInput,
    camera: WebGLSceneCamera,
    viewport: WebGLSceneViewport,
    bounds: WebGLSceneBounds,
    appearance?: Partial<WebGLSceneAppearance>
): WebGLProjectedPoint {
    const resolvedAppearance = resolveAppearance(appearance);
    const normalizedPosition = normalizePoint(point.position, bounds);
    const rotated = rotatePoint(normalizedPosition, camera);
    const depth = Math.max(camera.distance - rotated[2], 0.3);
    const perspective = camera.distance / depth;
    const screenX = viewport.width / 2 + rotated[0] * perspective * viewport.width * 0.22;
    const screenY = viewport.height / 2 - rotated[1] * perspective * viewport.height * 0.22;
    const baseSize = resolvedAppearance.basePointSize + (point.size ?? 0) * resolvedAppearance.sizeScale;
    const selectionScale = point.selected ? 1.18 : point.highlighted ? 1.08 : 1;
    const opacity = point.selected
        ? resolvedAppearance.selectedOpacity
        : point.highlighted
            ? resolvedAppearance.highlightOpacity
            : resolvedAppearance.pointOpacity;

    return {
        id: point.id,
        screenX,
        screenY,
        depth,
        size: Math.max(2.5, baseSize * perspective * selectionScale),
        selected: point.selected === true,
        highlighted: point.highlighted === true,
        color: scaleAlpha(resolveCssColor(point.color ?? resolvedAppearance.pointColor), opacity),
        worldPosition: point.position,
        normalizedPosition,
        payload: point.payload
    };
}

export function projectAxis(
    axis: WebGLSceneAxisInput,
    camera: WebGLSceneCamera,
    viewport: WebGLSceneViewport,
    appearance?: Partial<WebGLSceneAppearance>
): WebGLProjectedAxis {
    const resolvedAppearance = resolveAppearance(appearance);
    const start = rotatePoint(axis.start, camera);
    const end = rotatePoint(axis.end, camera);
    const startDepth = Math.max(camera.distance - start[2], 0.3);
    const endDepth = Math.max(camera.distance - end[2], 0.3);
    const startPerspective = camera.distance / startDepth;
    const endPerspective = camera.distance / endDepth;

    return {
        label: axis.label,
        start: axis.start,
        end: axis.end,
        startScreen: [
            viewport.width / 2 + start[0] * startPerspective * viewport.width * 0.22,
            viewport.height / 2 - start[1] * startPerspective * viewport.height * 0.22
        ],
        endScreen: [
            viewport.width / 2 + end[0] * endPerspective * viewport.width * 0.22,
            viewport.height / 2 - end[1] * endPerspective * viewport.height * 0.22
        ],
        color: scaleAlpha(resolveCssColor(axis.color ?? axisColorForLabel(axis.label, resolvedAppearance)), resolvedAppearance.axisOpacity)
    };
}

export function prepareSceneFrame(input: WebGLSceneFrameInput): WebGLPreparedScene {
    const appearance = resolveAppearance(input.appearance);
    const viewport = resolveViewport(input.viewport);
    const bounds = input.bounds ?? calculateSceneBounds(input.points);
    const axes = (input.axes?.length ? input.axes : buildDefaultAxes()).map((axis) =>
        projectAxis(axis, input.camera, viewport, appearance)
    );
    const points = input.points
        .map((point) => projectScenePoint(point, input.camera, viewport, bounds, appearance))
        .sort((left, right) => right.depth - left.depth);

    return {
        bounds,
        camera: input.camera,
        viewport,
        appearance,
        points,
        axes
    };
}

export function hitTestProjectedPoints(
    points: WebGLProjectedPoint[],
    screenX: number,
    screenY: number,
    hitRadius = 12
): WebGLSceneHitResult | undefined {
    let nearestPoint: WebGLProjectedPoint | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    points.forEach((point) => {
        const distance = distance2D(point.screenX, point.screenY, screenX, screenY);
        if (distance <= point.size + hitRadius && distance < nearestDistance) {
            nearestPoint = point;
            nearestDistance = distance;
        }
    });

    return nearestPoint ? { point: nearestPoint, distance: nearestDistance } : undefined;
}

export class WebGLSceneRenderer {
    private readonly canvas: HTMLCanvasElement;
    private readonly gl: WebGLRenderingContext | null;
    private readonly pointProgram: WebGLProgram | null;
    private readonly axisProgram: WebGLProgram | null;
    private readonly pointGeometry: GeometryBuffers;
    private readonly axisGeometry: GeometryBuffers;
    private frame?: WebGLPreparedScene;
    private frameInput?: WebGLSceneFrameInput;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.gl = (canvas.getContext("webgl", { alpha: true, antialias: true, preserveDrawingBuffer: true }) as WebGLRenderingContext | null)
            ?? (canvas.getContext("experimental-webgl", { alpha: true, antialias: true, preserveDrawingBuffer: true } as WebGLContextAttributes) as WebGLRenderingContext | null);
        this.pointGeometry = createGeometryBuffers(this.gl);
        this.axisGeometry = createGeometryBuffers(this.gl);
        this.pointProgram = this.gl ? createProgram(this.gl, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER) : null;
        this.axisProgram = this.gl ? createProgram(this.gl, AXIS_VERTEX_SHADER, AXIS_FRAGMENT_SHADER) : null;
    }

    public get isSupported(): boolean {
        return this.gl !== null;
    }

    public get currentFrame(): WebGLPreparedScene | undefined {
        return this.frame;
    }

    public resize(viewport: WebGLSceneViewport): void {
        const resolved = resolveViewport(viewport);
        const devicePixelRatio = resolved.devicePixelRatio;
        this.canvas.width = Math.max(1, Math.round(resolved.width * devicePixelRatio));
        this.canvas.height = Math.max(1, Math.round(resolved.height * devicePixelRatio));
        this.canvas.style.width = `${resolved.width}px`;
        this.canvas.style.height = `${resolved.height}px`;
        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.frameInput) {
            this.setFrame({ ...this.frameInput, viewport: resolved });
        }
    }

    public setFrame(input: WebGLSceneFrameInput): void {
        this.frameInput = input;
        this.frame = prepareSceneFrame(input);
        this.uploadGeometry();
    }

    public render(): void {
        if (!this.gl || !this.frame || !this.pointProgram || !this.axisProgram) {
            return;
        }

        const gl = this.gl;
        const { appearance, camera } = this.frame;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(...resolveCssColor(appearance.backgroundColor));
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);

        if (this.frame.axes.length > 0) {
            this.drawAxes(camera, appearance);
        }

        if (this.frame.points.length > 0) {
            this.drawPoints(camera, appearance);
        }
    }

    public hitTest(screenX: number, screenY: number, hitRadius = 12): WebGLSceneHitResult | undefined {
        if (!this.frame) {
            return undefined;
        }

        return hitTestProjectedPoints(this.frame.points, screenX, screenY, hitRadius);
    }

    public destroy(): void {
        if (!this.gl) {
            return;
        }

        deleteGeometryBuffers(this.gl, this.pointGeometry);
        deleteGeometryBuffers(this.gl, this.axisGeometry);
        if (this.pointProgram) {
            this.gl.deleteProgram(this.pointProgram);
        }
        if (this.axisProgram) {
            this.gl.deleteProgram(this.axisProgram);
        }
    }

    private uploadGeometry(): void {
        if (!this.gl || !this.frame) {
            return;
        }

        const pointPositions = new Float32Array(this.frame.points.length * 3);
        const pointColors = new Float32Array(this.frame.points.length * 4);
        const pointSizes = new Float32Array(this.frame.points.length);
        this.frame.points.forEach((point, index) => {
            pointPositions.set(point.normalizedPosition, index * 3);
            pointColors.set(point.color, index * 4);
            pointSizes[index] = point.size;
        });

        const axisPositions = new Float32Array(this.frame.axes.length * 2 * 3);
        const axisColors = new Float32Array(this.frame.axes.length * 2 * 4);
        this.frame.axes.forEach((axis, index) => {
            axisPositions.set(axis.start, index * 6);
            axisPositions.set(axis.end, index * 6 + 3);
            axisColors.set(axis.color, index * 8);
            axisColors.set(axis.color, index * 8 + 4);
        });

        uploadBuffer(this.gl, this.pointGeometry.positionBuffer, pointPositions);
        uploadBuffer(this.gl, this.pointGeometry.colorBuffer, pointColors);
        uploadBuffer(this.gl, this.pointGeometry.sizeBuffer, pointSizes);
        this.pointGeometry.count = this.frame.points.length;

        uploadBuffer(this.gl, this.axisGeometry.positionBuffer, axisPositions);
        uploadBuffer(this.gl, this.axisGeometry.colorBuffer, axisColors);
        this.axisGeometry.count = this.frame.axes.length * 2;
    }

    private drawPoints(camera: WebGLSceneCamera, appearance: WebGLSceneAppearance): void {
        if (!this.gl || !this.pointProgram || this.pointGeometry.count === 0) {
            return;
        }

        const gl = this.gl;
        gl.useProgram(this.pointProgram);
        bindAttribute(gl, this.pointProgram, "aPosition", this.pointGeometry.positionBuffer, 3);
        bindAttribute(gl, this.pointProgram, "aColor", this.pointGeometry.colorBuffer, 4);
        bindAttribute(gl, this.pointProgram, "aPointSize", this.pointGeometry.sizeBuffer, 1);
        setUniform(gl, this.pointProgram, "uYaw", camera.yaw);
        setUniform(gl, this.pointProgram, "uPitch", camera.pitch);
        setUniform(gl, this.pointProgram, "uDistance", camera.distance);
        setUniform(gl, this.pointProgram, "uSceneScale", appearance.sceneScale);
        setUniform(gl, this.pointProgram, "uPointScale", 1);
        gl.drawArrays(gl.POINTS, 0, this.pointGeometry.count);
    }

    private drawAxes(camera: WebGLSceneCamera, appearance: WebGLSceneAppearance): void {
        if (!this.gl || !this.axisProgram || this.axisGeometry.count === 0) {
            return;
        }

        const gl = this.gl;
        gl.useProgram(this.axisProgram);
        bindAttribute(gl, this.axisProgram, "aPosition", this.axisGeometry.positionBuffer, 3);
        bindAttribute(gl, this.axisProgram, "aColor", this.axisGeometry.colorBuffer, 4);
        setUniform(gl, this.axisProgram, "uYaw", camera.yaw);
        setUniform(gl, this.axisProgram, "uPitch", camera.pitch);
        setUniform(gl, this.axisProgram, "uDistance", camera.distance);
        setUniform(gl, this.axisProgram, "uSceneScale", appearance.sceneScale);
        gl.drawArrays(gl.LINES, 0, this.axisGeometry.count);
    }
}

function resolveViewport(viewport: WebGLSceneViewport): Required<WebGLSceneViewport> {
    return {
        width: Math.max(1, Math.round(viewport.width)),
        height: Math.max(1, Math.round(viewport.height)),
        devicePixelRatio: viewport.devicePixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)
    };
}

function normalizePoint(position: WebGLVec3, bounds: WebGLSceneBounds): WebGLVec3 {
    return [
        normalizeValue(position[0], bounds.x),
        normalizeValue(position[1], bounds.y),
        normalizeValue(position[2], bounds.z)
    ];
}

function normalizeValue(value: number, range: readonly [number, number]): number {
    const [min, max] = range;
    if (min === max) {
        return 0;
    }

    return ((value - min) / (max - min)) * 2 - 1;
}

function expandRange(range: readonly [number, number]): readonly [number, number] {
    const [min, max] = range;
    if (min === max) {
        return [min - 0.5, max + 0.5];
    }

    return [min, max];
}

function extent(values: number[]): readonly [number, number] {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    values.forEach((value) => {
        min = Math.min(min, value);
        max = Math.max(max, value);
    });
    return [min, max];
}

function rotatePoint(position: WebGLVec3, camera: WebGLSceneCamera): WebGLVec3 {
    const cosYaw = Math.cos(camera.yaw);
    const sinYaw = Math.sin(camera.yaw);
    const yawX = position[0] * cosYaw - position[2] * sinYaw;
    const yawZ = position[0] * sinYaw + position[2] * cosYaw;
    const cosPitch = Math.cos(camera.pitch);
    const sinPitch = Math.sin(camera.pitch);
    const pitchY = position[1] * cosPitch - yawZ * sinPitch;
    const pitchZ = position[1] * sinPitch + yawZ * cosPitch;
    return [yawX, pitchY, pitchZ];
}

function distance2D(ax: number, ay: number, bx: number, by: number): number {
    return Math.hypot(ax - bx, ay - by);
}

function resolveCssColor(color: string, alphaOverride?: number): WebGLVec4 {
    const parsed = parseCssColor(color);
    if (parsed) {
        return alphaOverride === undefined ? parsed : [parsed[0], parsed[1], parsed[2], alphaOverride];
    }

    const context = getColorContext();
    if (context) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = "#000000";
        context.fillStyle = color;
        return parseCssColor(context.fillStyle, alphaOverride) ?? [1, 1, 1, alphaOverride ?? 1];
    }

    return [1, 1, 1, alphaOverride ?? 1];
}

function parseCssColor(color: string, alphaOverride?: number): WebGLVec4 | undefined {
    const normalized = color.trim().toLowerCase();

    if (normalized.startsWith("#")) {
        const hex = normalized.slice(1);
        const expanded = hex.length === 3 || hex.length === 4
            ? hex.split("").map((part) => `${part}${part}`).join("")
            : hex;
        if (expanded.length !== 6 && expanded.length !== 8) {
            return undefined;
        }

        const red = Number.parseInt(expanded.slice(0, 2), 16) / 255;
        const green = Number.parseInt(expanded.slice(2, 4), 16) / 255;
        const blue = Number.parseInt(expanded.slice(4, 6), 16) / 255;
        const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
        return [red, green, blue, alphaOverride ?? alpha];
    }

    const rgbMatch = normalized.match(/^rgba?\((.+)\)$/);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(",").map((part) => part.trim());
        if (parts.length < 3) {
            return undefined;
        }

        const red = parseColorChannel(parts[0]);
        const green = parseColorChannel(parts[1]);
        const blue = parseColorChannel(parts[2]);
        const alpha = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
        return [red, green, blue, alphaOverride ?? clamp(alpha, 0, 1)];
    }

    const hslMatch = normalized.match(/^hsla?\((.+)\)$/);
    if (hslMatch) {
        const parts = hslMatch[1].split(",").map((part) => part.trim());
        if (parts.length < 3) {
            return undefined;
        }

        const hue = Number.parseFloat(parts[0]);
        const saturation = parseColorPercent(parts[1]);
        const lightness = parseColorPercent(parts[2]);
        const alpha = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
        const [red, green, blue] = hslToRgb(hue, saturation, lightness);
        return [red, green, blue, alphaOverride ?? clamp(alpha, 0, 1)];
    }

    return undefined;
}

function parseColorChannel(value: string): number {
    if (value.endsWith("%")) {
        return clamp(Number.parseFloat(value) / 100, 0, 1);
    }

    return clamp(Number.parseFloat(value) / 255, 0, 1);
}

function parseColorPercent(value: string): number {
    return clamp(Number.parseFloat(value) / 100, 0, 1);
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
    const normalizedHue = (((hue % 360) + 360) % 360) / 360;
    if (saturation === 0) {
        return [lightness, lightness, lightness];
    }

    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    return [
        hueToRgb(p, q, normalizedHue + 1 / 3),
        hueToRgb(p, q, normalizedHue),
        hueToRgb(p, q, normalizedHue - 1 / 3)
    ];
}

function hueToRgb(p: number, q: number, t: number): number {
    let normalized = t;
    if (normalized < 0) {
        normalized += 1;
    }
    if (normalized > 1) {
        normalized -= 1;
    }

    if (normalized < 1 / 6) {
        return p + (q - p) * 6 * normalized;
    }
    if (normalized < 1 / 2) {
        return q;
    }
    if (normalized < 2 / 3) {
        return p + (q - p) * (2 / 3 - normalized) * 6;
    }

    return p;
}

function scaleAlpha(color: WebGLVec4, alpha: number): WebGLVec4 {
    return [color[0], color[1], color[2], clamp(color[3] * alpha, 0, 1)];
}

function axisColorForLabel(label: string, appearance: WebGLSceneAppearance): string {
    switch (label.toUpperCase()) {
        case "X":
            return appearance.axisXColor;
        case "Y":
            return appearance.axisYColor;
        case "Z":
            return appearance.axisZColor;
        default:
            return appearance.pointColor;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function getColorContext(): CanvasRenderingContext2D | null {
    if (colorContext) {
        return colorContext;
    }

    if (typeof document === "undefined") {
        return null;
    }

    colorContext = document.createElement("canvas").getContext("2d");
    return colorContext;
}

function createGeometryBuffers(gl: WebGLRenderingContext | null): GeometryBuffers {
    if (!gl) {
        return { positionBuffer: null, colorBuffer: null, sizeBuffer: null, count: 0 };
    }

    return {
        positionBuffer: gl.createBuffer(),
        colorBuffer: gl.createBuffer(),
        sizeBuffer: gl.createBuffer(),
        count: 0
    };
}

function deleteGeometryBuffers(gl: WebGLRenderingContext, geometry: GeometryBuffers): void {
    if (geometry.positionBuffer) {
        gl.deleteBuffer(geometry.positionBuffer);
    }
    if (geometry.colorBuffer) {
        gl.deleteBuffer(geometry.colorBuffer);
    }
    if (geometry.sizeBuffer) {
        gl.deleteBuffer(geometry.sizeBuffer);
    }
}

function uploadBuffer(gl: WebGLRenderingContext, buffer: WebGLBuffer | null, data: Float32Array): void {
    if (!buffer) {
        return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
}

function bindAttribute(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    attributeName: string,
    buffer: WebGLBuffer | null,
    size: number
): void {
    if (!buffer) {
        return;
    }

    const location = gl.getAttribLocation(program, attributeName);
    if (location < 0) {
        return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function setUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string, value: number): void {
    const location = gl.getUniformLocation(program, name);
    if (location !== null) {
        gl.uniform1f(location, value);
    }
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) {
        throw new Error("Unable to create WebGL program.");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const reason = gl.getProgramInfoLog(program) ?? "Unknown WebGL link failure.";
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error(reason);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error("Unable to create WebGL shader.");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const reason = gl.getShaderInfoLog(shader) ?? "Unknown WebGL compile failure.";
        gl.deleteShader(shader);
        throw new Error(reason);
    }

    return shader;
}

interface GeometryBuffers {
    positionBuffer: WebGLBuffer | null;
    colorBuffer: WebGLBuffer | null;
    sizeBuffer: WebGLBuffer | null;
    count: number;
}
