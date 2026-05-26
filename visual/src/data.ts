import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import DataViewCategorical = powerbi.DataViewCategorical;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewObject = powerbi.DataViewObject;
import DataViewObjects = powerbi.DataViewObjects;
import DataViewValueColumn = powerbi.DataViewValueColumn;

type Primitive = powerbi.PrimitiveValue;

export interface TooltipItem {
    displayName: string;
    value: string;
}

export interface ScatterPoint {
    x: number;
    y: number;
    z: number;
    size?: number;
    markerColor?: string;
    xHighlight?: number;
    yHighlight?: number;
    zHighlight?: number;
    hasHighlight: boolean;
    category?: Primitive;
    tooltips: Primitive[];
    tooltipItems: TooltipItem[];
    sourceIndex: number;
}

export interface ParsedDataSet {
    fields: Record<string, string | undefined>;
    missingRequiredRoles: string[];
    pointCount: number;
    validPointCount: number;
    highlightCount: number;
    points: ScatterPoint[];
}

export function parseDataView(dataView?: DataView): ParsedDataSet {
    const categorical = dataView?.categorical;
    const fields = {
        x: getRoleDisplayName(categorical, "x"),
        y: getRoleDisplayName(categorical, "y"),
        z: getRoleDisplayName(categorical, "z"),
        size: getRoleDisplayName(categorical, "size"),
        category: getRoleDisplayName(categorical, "category")
    };

    const missingRequiredRoles = ["x", "y", "z"].filter((role) => !fields[role]);
    const xColumn = findValueColumn(categorical, "x");
    const yColumn = findValueColumn(categorical, "y");
    const zColumn = findValueColumn(categorical, "z");
    const sizeColumn = findValueColumn(categorical, "size");
    const tooltipColumns = findValueColumns(categorical, "tooltip");
    const categoryColumn = findCategoryColumn(categorical, "category");

    const rowCount = getRowCount([
        xColumn,
        yColumn,
        zColumn,
        sizeColumn,
        categoryColumn,
        ...tooltipColumns
    ]);

    const points: ScatterPoint[] = [];
    let highlightCount = 0;
    for (let index = 0; index < rowCount; index += 1) {
        const x = toNumber(xColumn?.values?.[index]);
        const y = toNumber(yColumn?.values?.[index]);
        const z = toNumber(zColumn?.values?.[index]);
        const xHighlight = toNumber(xColumn?.highlights?.[index]);
        const yHighlight = toNumber(yColumn?.highlights?.[index]);
        const zHighlight = toNumber(zColumn?.highlights?.[index]);

        if (x === undefined || y === undefined || z === undefined) {
            continue;
        }

        const hasHighlight = xHighlight !== undefined || yHighlight !== undefined || zHighlight !== undefined;
        if (hasHighlight) {
            highlightCount += 1;
        }

        points.push({
            x,
            y,
            z,
            size: toNumber(sizeColumn?.values?.[index]),
            markerColor: getMarkerColor(categoryColumn?.objects?.[index]),
            xHighlight,
            yHighlight,
            zHighlight,
            hasHighlight,
            category: categoryColumn?.values?.[index],
            tooltips: tooltipColumns.map((column) => column.values?.[index]).filter((value) => value !== undefined),
            tooltipItems: buildTooltipItems(index, {
                categoryColumn,
                xColumn,
                yColumn,
                zColumn,
                sizeColumn,
                tooltipColumns
            }),
            sourceIndex: index
        });
    }

    return {
        fields,
        missingRequiredRoles,
        pointCount: rowCount,
        validPointCount: points.length,
        highlightCount,
        points
    };
}

function getRoleDisplayName(categorical: DataViewCategorical | undefined, role: string): string | undefined {
    return findValueColumn(categorical, role)?.source.displayName ?? findCategoryColumn(categorical, role)?.source.displayName;
}

function findValueColumn(categorical: DataViewCategorical | undefined, role: string): DataViewValueColumn | undefined {
    return categorical?.values?.find((column) => column.source.roles?.[role]);
}

function findValueColumns(categorical: DataViewCategorical | undefined, role: string): DataViewValueColumn[] {
    return categorical?.values?.filter((column) => column.source.roles?.[role]) ?? [];
}

function findCategoryColumn(categorical: DataViewCategorical | undefined, role: string): DataViewCategoryColumn | undefined {
    return categorical?.categories?.find((column) => column.source.roles?.[role]);
}

function getRowCount(columns: Array<{ values?: Primitive[] } | undefined>): number {
    return columns.reduce((max, column) => Math.max(max, column?.values?.length ?? 0), 0);
}

function toNumber(value: Primitive | undefined): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    return undefined;
}

function buildTooltipItems(
    index: number,
    columns: {
        categoryColumn?: DataViewCategoryColumn;
        xColumn?: DataViewValueColumn;
        yColumn?: DataViewValueColumn;
        zColumn?: DataViewValueColumn;
        sizeColumn?: DataViewValueColumn;
        tooltipColumns: DataViewValueColumn[];
    }
): TooltipItem[] {
    const items: TooltipItem[] = [];

    maybePush(items, columns.categoryColumn?.source.displayName, columns.categoryColumn?.values?.[index]);
    maybePush(items, columns.xColumn?.source.displayName, columns.xColumn?.values?.[index]);
    maybePush(items, columns.yColumn?.source.displayName, columns.yColumn?.values?.[index]);
    maybePush(items, columns.zColumn?.source.displayName, columns.zColumn?.values?.[index]);
    maybePush(items, columns.sizeColumn?.source.displayName, columns.sizeColumn?.values?.[index]);

    columns.tooltipColumns.forEach((column) => {
        maybePush(items, column.source.displayName, column.values?.[index]);
    });

    return items;
}

function maybePush(items: TooltipItem[], displayName: string | undefined, value: Primitive | undefined): void {
    if (!displayName || value === undefined || value === null) {
        return;
    }

    items.push({
        displayName,
        value: String(value)
    });
}

function getMarkerColor(objects: DataViewObjects | undefined): string | undefined {
    const markerObject = objects?.markers as DataViewObject | undefined;
    const fill = markerObject?.defaultColor as powerbi.Fill | undefined;
    return fill?.solid?.color;
}
