import * as assert from "node:assert/strict";

const { parseDataView } = await import("../.tmp/tests/data.js");
const { clamp, distance2D, limitScenePoints, projectPoint, summarizeScene } = await import("../.tmp/tests/scene.js");
const {
    buildDefaultAxes,
    calculateSceneBounds,
    hitTestProjectedPoints,
    prepareSceneFrame,
    projectScenePoint
} = await import("../.tmp/tests/webglScene.js");

run("marks missing required axes when bindings are absent", () => {
    const parsed = parseDataView();

    assert.deepEqual(parsed.missingRequiredRoles, ["x", "y", "z"]);
    assert.equal(parsed.pointCount, 0);
    assert.equal(parsed.validPointCount, 0);
    assert.equal(parsed.highlightCount, 0);
});

run("builds renderable points from bound categorical data", () => {
    const parsed = parseDataView({
        categorical: {
            categories: [
                {
                    source: {
                        displayName: "Segment",
                        roles: { category: true }
                    },
                    values: ["A", "B", "C"],
                    identity: []
                }
            ],
            values: [
                {
                    source: {
                        displayName: "X Value",
                        roles: { x: true }
                    },
                    values: [1, 2, 3]
                },
                {
                    source: {
                        displayName: "Y Value",
                        roles: { y: true }
                    },
                    values: [10, 20, 30]
                },
                {
                    source: {
                        displayName: "Z Value",
                        roles: { z: true }
                    },
                    values: [100, 200, 300]
                },
                {
                    source: {
                        displayName: "Size Value",
                        roles: { size: true }
                    },
                    values: [4, 5, 6]
                },
                {
                    source: {
                        displayName: "Tooltip Value",
                        roles: { tooltip: true }
                    },
                    values: ["one", "two", "three"]
                }
            ]
        }
    });

    assert.deepEqual(parsed.missingRequiredRoles, []);
    assert.equal(parsed.pointCount, 3);
    assert.equal(parsed.validPointCount, 3);
    assert.equal(parsed.highlightCount, 0);
    assert.deepEqual(parsed.fields, {
        x: "X Value",
        y: "Y Value",
        z: "Z Value",
        size: "Size Value",
        category: "Segment"
    });
    assert.deepEqual(parsed.points[1], {
        x: 2,
        y: 20,
        z: 200,
        size: 5,
        markerColor: undefined,
        xHighlight: undefined,
        yHighlight: undefined,
        zHighlight: undefined,
        hasHighlight: false,
        category: "B",
        tooltips: ["two"],
        tooltipItems: [
            { displayName: "Segment", value: "B" },
            { displayName: "X Value", value: "2" },
            { displayName: "Y Value", value: "20" },
            { displayName: "Z Value", value: "200" },
            { displayName: "Size Value", value: "5" },
            { displayName: "Tooltip Value", value: "two" }
        ],
        sourceIndex: 1
    });
});

run("filters out rows that do not have complete xyz coordinates", () => {
    const parsed = parseDataView({
        categorical: {
            values: [
                {
                    source: {
                        displayName: "X Value",
                        roles: { x: true }
                    },
                    values: [1, 2, 3]
                },
                {
                    source: {
                        displayName: "Y Value",
                        roles: { y: true }
                    },
                    values: [10, null, 30]
                },
                {
                    source: {
                        displayName: "Z Value",
                        roles: { z: true }
                    },
                    values: [100, 200, "bad"]
                }
            ]
        }
    });

    assert.equal(parsed.pointCount, 3);
    assert.equal(parsed.validPointCount, 1);
    assert.equal(parsed.highlightCount, 0);
    assert.deepEqual(parsed.points, [
        {
            x: 1,
            y: 10,
            z: 100,
            size: undefined,
            markerColor: undefined,
            xHighlight: undefined,
            yHighlight: undefined,
            zHighlight: undefined,
            hasHighlight: false,
            category: undefined,
            tooltips: [],
            tooltipItems: [
                { displayName: "X Value", value: "1" },
                { displayName: "Y Value", value: "10" },
                { displayName: "Z Value", value: "100" }
            ],
            sourceIndex: 0
        }
    ]);
});

run("reads marker color from category formatting objects", () => {
    const parsed = parseDataView({
        categorical: {
            categories: [
                {
                    source: {
                        displayName: "Segment",
                        roles: { category: true }
                    },
                    values: ["A", "B"],
                    identity: [],
                    objects: [
                        { markers: { defaultColor: { solid: { color: "#ff0000" } } } },
                        { markers: { defaultColor: { solid: { color: "#00ff00" } } } }
                    ]
                }
            ],
            values: [
                {
                    source: {
                        displayName: "X Value",
                        roles: { x: true }
                    },
                    values: [1, 2]
                },
                {
                    source: {
                        displayName: "Y Value",
                        roles: { y: true }
                    },
                    values: [10, 20]
                },
                {
                    source: {
                        displayName: "Z Value",
                        roles: { z: true }
                    },
                    values: [100, 200]
                }
            ]
        }
    });

    assert.equal(parsed.points[0].markerColor, "#ff0000");
    assert.equal(parsed.points[1].markerColor, "#00ff00");
});

run("counts highlight rows when highlight values are present", () => {
    const parsed = parseDataView({
        categorical: {
            values: [
                {
                    source: {
                        displayName: "X Value",
                        roles: { x: true }
                    },
                    values: [1, 2],
                    highlights: [1, null]
                },
                {
                    source: {
                        displayName: "Y Value",
                        roles: { y: true }
                    },
                    values: [10, 20]
                },
                {
                    source: {
                        displayName: "Z Value",
                        roles: { z: true }
                    },
                    values: [100, 200]
                }
            ]
        }
    });

    assert.equal(parsed.highlightCount, 1);
    assert.equal(parsed.points[0].hasHighlight, true);
    assert.equal(parsed.points[1].hasHighlight, false);
});

run("summarizeScene normalizes point positions into scene space", () => {
    const summary = summarizeScene([
        { x: 10, y: 20, z: 30, size: 1, markerColor: "#ff0000", category: "A", tooltips: [] },
        { x: 20, y: 40, z: 60, size: 3, markerColor: "#00ff00", category: "B", tooltips: [] }
    ]);

    assert.deepEqual(summary.xRange, [10, 20]);
    assert.deepEqual(summary.yRange, [20, 40]);
    assert.deepEqual(summary.zRange, [30, 60]);
    assert.equal(summary.normalizedPoints[0].x, -1);
    assert.equal(summary.normalizedPoints[1].x, 1);
});

run("projectPoint returns stable projected coordinates and size", () => {
    const projected = projectPoint(
        { x: 0.5, y: -0.25, z: 0.1, size: 0.6, category: "A" },
        { yaw: 0.3, pitch: -0.2, distance: 4.4 }
    );

    assert.equal(typeof projected.x, "number");
    assert.equal(typeof projected.y, "number");
    assert.equal(typeof projected.depth, "number");
    assert.ok(projected.size > 0);
});

run("utility math helpers stay stable", () => {
    assert.equal(clamp(3, 0, 2), 2);
    assert.equal(distance2D(0, 0, 3, 4), 5);
});

run("limitScenePoints preserves highlighted rows while downsampling", () => {
    const points = Array.from({ length: 8 }, (_, index) => ({
        x: index,
        y: index,
        z: index,
        hasHighlight: index === 2 || index === 6
    }));

    const limited = limitScenePoints(points, 4);
    assert.equal(limited.length, 4);
    assert.ok(limited.some((point) => point.x === 2));
    assert.ok(limited.some((point) => point.x === 6));
});

run("prepares a WebGL scene frame with normalized points and axes", () => {
    const frame = prepareSceneFrame({
        points: [
            { id: "a", position: [10, 20, 30], size: 1, color: "#38bdf8" },
            { id: "b", position: [20, 40, 60], size: 2, color: "#f97316", highlighted: true }
        ],
        camera: { yaw: 0.2, pitch: -0.1, distance: 4.4 },
        viewport: { width: 800, height: 600, devicePixelRatio: 1 }
    });

    assert.deepEqual(frame.bounds.x, [10, 20]);
    assert.equal(frame.points.length, 2);
    assert.equal(frame.axes.length, 3);
    assert.equal(frame.points.some((point) => point.id === "b" && point.highlighted), true);
    assert.equal(typeof frame.points[0].screenX, "number");
    assert.ok(frame.points.every((point) => point.size > 0));
});

run("projectScenePoint mirrors the frame projection math", () => {
    const bounds = calculateSceneBounds([
        { id: "a", position: [10, 20, 30] },
        { id: "b", position: [20, 40, 60] }
    ]);
    const point = projectScenePoint(
        { id: "b", position: [20, 40, 60], size: 2, color: "hsl(24, 90%, 60%)" },
        { yaw: 0.2, pitch: -0.1, distance: 4.4 },
        { width: 800, height: 600, devicePixelRatio: 1 },
        bounds
    );

    assert.equal(point.id, "b");
    assert.equal(point.normalizedPosition[0], 1);
    assert.equal(point.selected, false);
    assert.equal(point.highlighted, false);
    assert.ok(point.screenX > 0);
    assert.ok(point.size > 0);
});

run("hitTestProjectedPoints returns the nearest visible point", () => {
    const points = [
        {
            id: "left",
            screenX: 100,
            screenY: 100,
            depth: 2,
            size: 12,
            selected: false,
            highlighted: false,
            color: [1, 1, 1, 1],
            worldPosition: [0, 0, 0],
            normalizedPosition: [0, 0, 0]
        },
        {
            id: "right",
            screenX: 140,
            screenY: 100,
            depth: 1,
            size: 12,
            selected: false,
            highlighted: false,
            color: [1, 1, 1, 1],
            worldPosition: [0, 0, 0],
            normalizedPosition: [0, 0, 0]
        }
    ];

    const hit = hitTestProjectedPoints(points, 136, 102, 10);
    assert.equal(hit?.point.id, "right");
});

run("buildDefaultAxes creates a predictable 3-axis foundation", () => {
    const axes = buildDefaultAxes();
    assert.equal(axes.length, 3);
    assert.equal(axes[0].label, "X");
    assert.deepEqual(axes[1].start, [0, -1, 0]);
});

function run(name, testFn) {
    try {
        testFn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}
