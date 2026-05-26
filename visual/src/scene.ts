import { ScatterPoint } from "./data";

export interface NormalizedPoint {
    x: number;
    y: number;
    z: number;
    size: number;
    category?: ScatterPoint["category"];
}

export interface SceneSummary {
    normalizedPoints: NormalizedPoint[];
    xRange: [number, number];
    yRange: [number, number];
    zRange: [number, number];
    sizeRange?: [number, number];
}

export interface OrbitState {
    yaw: number;
    pitch: number;
    distance: number;
}

export interface ProjectedPoint {
    x: number;
    y: number;
    z: number;
    size: number;
    depth: number;
}

export function summarizeScene(points: ScatterPoint[]): SceneSummary {
    const xRange = extent(points.map((point) => point.x));
    const yRange = extent(points.map((point) => point.y));
    const zRange = extent(points.map((point) => point.z));
    const sizeValues = points.map((point) => point.size).filter(isNumber);
    const sizeRange = sizeValues.length > 0 ? extent(sizeValues) : undefined;

    return {
        normalizedPoints: points.map((point) => ({
            x: normalize(point.x, xRange),
            y: normalize(point.y, yRange),
            z: normalize(point.z, zRange),
            size: normalizeOptional(point.size, sizeRange, 0.45),
            category: point.category
        })),
        xRange,
        yRange,
        zRange,
        sizeRange
    };
}

export function projectPoint(point: NormalizedPoint, orbit: OrbitState): ProjectedPoint {
    const cosYaw = Math.cos(orbit.yaw);
    const sinYaw = Math.sin(orbit.yaw);
    const cosPitch = Math.cos(orbit.pitch);
    const sinPitch = Math.sin(orbit.pitch);

    const yawX = point.x * cosYaw - point.z * sinYaw;
    const yawZ = point.x * sinYaw + point.z * cosYaw;

    const pitchY = point.y * cosPitch - yawZ * sinPitch;
    const pitchZ = point.y * sinPitch + yawZ * cosPitch;

    const depth = orbit.distance - pitchZ;
    const perspective = orbit.distance / Math.max(depth, 0.3);

    return {
        x: yawX * perspective,
        y: pitchY * perspective,
        z: pitchZ,
        depth,
        size: Math.max(2.5, 3 + point.size * 8) * perspective
    };
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function distance2D(ax: number, ay: number, bx: number, by: number): number {
    return Math.hypot(ax - bx, ay - by);
}

export function limitScenePoints(points: ScatterPoint[], maxPoints: number): ScatterPoint[] {
    const safeLimit = Math.max(0, Math.floor(maxPoints));
    if (safeLimit === 0) {
        return [];
    }

    if (points.length <= safeLimit) {
        return points;
    }

    const highlightedIndices = points
        .map((point, index) => ({ point, index }))
        .filter(({ point }) => point.hasHighlight)
        .map(({ index }) => index);

    if (highlightedIndices.length >= safeLimit) {
        return highlightedIndices.slice(0, safeLimit).map((index) => points[index]);
    }

    const chosen = new Set<number>(highlightedIndices);
    const remainingBudget = safeLimit - chosen.size;
    const candidateIndices = points
        .map((_, index) => index)
        .filter((index) => !chosen.has(index));
    const stride = candidateIndices.length / remainingBudget;

    for (let sampleIndex = 0; sampleIndex < remainingBudget; sampleIndex += 1) {
        const candidateIndex = candidateIndices[Math.min(candidateIndices.length - 1, Math.floor(sampleIndex * stride))];
        chosen.add(candidateIndex);
    }

    return Array.from(chosen)
        .sort((left, right) => left - right)
        .map((index) => points[index]);
}

function extent(values: number[]): [number, number] {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    values.forEach((value) => {
        min = Math.min(min, value);
        max = Math.max(max, value);
    });

    return [min, max];
}

function normalize(value: number, range: [number, number]): number {
    const [min, max] = range;
    if (min === max) {
        return 0;
    }

    return ((value - min) / (max - min)) * 2 - 1;
}

function normalizeOptional(
    value: number | undefined,
    range: [number, number] | undefined,
    fallback: number
): number {
    if (value === undefined || !range) {
        return fallback;
    }

    const [min, max] = range;
    if (min === max) {
        return 0.75;
    }

    return (value - min) / (max - min);
}

function isNumber(value: number | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value);
}
