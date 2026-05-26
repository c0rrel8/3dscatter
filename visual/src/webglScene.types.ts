export type WebGLVec3 = readonly [number, number, number];
export type WebGLVec4 = readonly [number, number, number, number];

export interface WebGLSceneBounds {
    x: readonly [number, number];
    y: readonly [number, number];
    z: readonly [number, number];
}

export interface WebGLSceneCamera {
    yaw: number;
    pitch: number;
    distance: number;
}

export interface WebGLSceneViewport {
    width: number;
    height: number;
    devicePixelRatio?: number;
}

export interface WebGLScenePointInput {
    id: string;
    position: WebGLVec3;
    size?: number;
    color?: string;
    selected?: boolean;
    highlighted?: boolean;
    payload?: unknown;
}

export interface WebGLSceneAxisInput {
    label: string;
    start: WebGLVec3;
    end: WebGLVec3;
    color?: string;
}

export interface WebGLSceneAppearance {
    backgroundColor: string;
    pointColor: string;
    axisXColor: string;
    axisYColor: string;
    axisZColor: string;
    pointOpacity: number;
    selectedOpacity: number;
    highlightOpacity: number;
    axisOpacity: number;
    basePointSize: number;
    sizeScale: number;
    sceneScale: number;
}

export interface WebGLSceneFrameInput {
    points: WebGLScenePointInput[];
    camera: WebGLSceneCamera;
    viewport: WebGLSceneViewport;
    bounds?: WebGLSceneBounds;
    axes?: WebGLSceneAxisInput[];
    appearance?: Partial<WebGLSceneAppearance>;
}

export interface WebGLProjectedPoint {
    id: string;
    screenX: number;
    screenY: number;
    depth: number;
    size: number;
    selected: boolean;
    highlighted: boolean;
    color: WebGLVec4;
    worldPosition: WebGLVec3;
    normalizedPosition: WebGLVec3;
    payload?: unknown;
}

export interface WebGLProjectedAxis {
    label: string;
    start: WebGLVec3;
    end: WebGLVec3;
    startScreen: readonly [number, number];
    endScreen: readonly [number, number];
    color: WebGLVec4;
}

export interface WebGLPreparedScene {
    bounds: WebGLSceneBounds;
    camera: WebGLSceneCamera;
    viewport: Required<WebGLSceneViewport>;
    appearance: WebGLSceneAppearance;
    points: WebGLProjectedPoint[];
    axes: WebGLProjectedAxis[];
}

export interface WebGLSceneHitResult {
    point: WebGLProjectedPoint;
    distance: number;
}
