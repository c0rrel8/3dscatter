import * as assert from "node:assert/strict";

import { clamp, distance2D, paletteColor, projectPoint, summarizeScene } from "./scene";

run("summarizeScene normalizes point positions into scene space", () => {
    const summary = summarizeScene([
        { x: 10, y: 20, z: 30, size: 1, color: 5, category: "A", tooltips: [] },
        { x: 20, y: 40, z: 60, size: 3, color: 9, category: "B", tooltips: [] }
    ]);

    assert.deepEqual(summary.xRange, [10, 20]);
    assert.deepEqual(summary.yRange, [20, 40]);
    assert.deepEqual(summary.zRange, [30, 60]);
    assert.equal(summary.normalizedPoints[0].x, -1);
    assert.equal(summary.normalizedPoints[1].x, 1);
});

run("projectPoint returns stable projected coordinates and size", () => {
    const projected = projectPoint(
        { x: 0.5, y: -0.25, z: 0.1, size: 0.6, colorValue: 8, category: "A" },
        { yaw: 0.3, pitch: -0.2, distance: 4.4 }
    );

    assert.equal(typeof projected.x, "number");
    assert.equal(typeof projected.y, "number");
    assert.equal(typeof projected.depth, "number");
    assert.ok(projected.size > 0);
});

run("paletteColor falls back cleanly when no color field is bound", () => {
    assert.equal(paletteColor(undefined, undefined, "#38bdf8"), "#38bdf8");
    assert.equal(clamp(3, 0, 2), 2);
    assert.equal(distance2D(0, 0, 3, 4), 5);
});

function run(name: string, fn: () => void): void {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}
