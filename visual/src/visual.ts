import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import "./../style/visual.less";

import DataView = powerbi.DataView;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import IViewport = powerbi.IViewport;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import FormattingSettingsSlice = formattingSettings.Slice;

import { ParsedDataSet, ScatterPoint, parseDataView } from "./data";
import { clamp, distance2D, limitScenePoints, OrbitState, projectPoint, summarizeScene } from "./scene";
import { VisualFormattingSettingsModel } from "./settings";
import { WebGLSceneRenderer } from "./webglScene";

interface RenderedPoint {
    point: ScatterPoint;
    screenX: number;
    screenY: number;
    radius: number;
    fill: string;
    selectionKey?: string;
    selectionId?: ISelectionId;
}

interface LegendItem {
    label: string;
    color: string;
}

interface WebglPayload {
    point: ScatterPoint;
    fill: string;
    selectionKey?: string;
    selectionId?: ISelectionId;
}

const VISUAL_VERSION = "0.5.1.0";

export class Visual implements IVisual {
    private readonly formattingSettingsService: FormattingSettingsService;
    private readonly host: powerbi.extensibility.visual.IVisualHost;
    private readonly colorPalette: ISandboxExtendedColorPalette;
    private readonly localizationManager: ILocalizationManager;
    private readonly selectionManager: ISelectionManager;
    private formattingSettings!: VisualFormattingSettingsModel;
    private readonly root: HTMLDivElement;
    private readonly headerNode: HTMLDivElement;
    private readonly titleNode: HTMLHeadingElement;
    private readonly summaryNode: HTMLParagraphElement;
    private readonly sceneFrame: HTMLDivElement;
    private readonly canvas: HTMLCanvasElement;
    private readonly overlayNode: HTMLDivElement;
    private readonly tooltipNode: HTMLDivElement;
    private readonly legendNode: HTMLDivElement;
    private readonly badgesNode: HTMLDivElement;
    private readonly statusNode: HTMLParagraphElement;
    private readonly detailsNode: HTMLUListElement;
    private readonly footerNode: HTMLParagraphElement;
    private readonly orbit: OrbitState;
    private parsed: ParsedDataSet;
    private renderedPoints: RenderedPoint[];
    private selectedKeys: Set<string>;
    private isDragging: boolean;
    private dragOrigin?: { x: number; y: number; yaw: number; pitch: number };
    private hoveredPoint?: RenderedPoint;
    private viewport: IViewport;
    private dataView?: DataView;
    private animationHandle?: number;
    private allowInteractions: boolean;
    private webglRenderer?: WebGLSceneRenderer | null;
    private canvas2DContext?: CanvasRenderingContext2D | null;
    private fetchStatus: string;
    private lastOperationKindLabel: string;
    private fetchRequestedPointCount?: number;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.host = options.host;
        this.colorPalette = options.host.colorPalette;
        this.localizationManager = options.host.createLocalizationManager();
        this.selectionManager = options.host.createSelectionManager();
        this.selectionManager.registerOnSelectCallback((ids: ISelectionId[]) => {
            this.selectedKeys = new Set(ids.map((id) => selectionKey(id)).filter(isDefined));
            this.renderScene();
        });

        this.orbit = { yaw: 0.65, pitch: -0.4, distance: 4.6 };
        this.parsed = {
            fields: {},
            missingRequiredRoles: ["x", "y", "z"],
            pointCount: 0,
            validPointCount: 0,
            highlightCount: 0,
            points: []
        };
        this.renderedPoints = [];
        this.selectedKeys = new Set<string>();
        this.isDragging = false;
        this.viewport = { width: 640, height: 480 };
        this.allowInteractions = true;
        this.webglRenderer = undefined;
        this.canvas2DContext = undefined;
        this.fetchStatus = "Idle";
        this.lastOperationKindLabel = "Create";
        this.fetchRequestedPointCount = undefined;

        this.root = document.createElement("div");
        this.root.className = "scatter3d";
        this.headerNode = document.createElement("div");
        this.headerNode.className = "scatter3d__header";
        this.titleNode = document.createElement("h2");
        this.titleNode.className = "scatter3d__title";
        this.titleNode.textContent = this.text("Visual_Title");
        this.summaryNode = document.createElement("p");
        this.summaryNode.className = "scatter3d__summary";
        this.sceneFrame = document.createElement("div");
        this.sceneFrame.className = "scatter3d__scene-frame";
        this.sceneFrame.tabIndex = 0;
        this.canvas = document.createElement("canvas");
        this.canvas.className = "scatter3d__canvas";
        this.overlayNode = document.createElement("div");
        this.overlayNode.className = "scatter3d__overlay";
        this.tooltipNode = document.createElement("div");
        this.tooltipNode.className = "scatter3d__tooltip";
        this.tooltipNode.hidden = true;
        this.legendNode = document.createElement("div");
        this.legendNode.className = "scatter3d__legend";
        this.legendNode.hidden = true;
        this.badgesNode = document.createElement("div");
        this.badgesNode.className = "scatter3d__badges";
        this.statusNode = document.createElement("p");
        this.statusNode.className = "scatter3d__status";
        this.detailsNode = document.createElement("ul");
        this.detailsNode.className = "scatter3d__details";
        this.footerNode = document.createElement("p");
        this.footerNode.className = "scatter3d__footer";

        this.headerNode.appendChild(this.titleNode);
        this.headerNode.appendChild(this.summaryNode);
        this.sceneFrame.appendChild(this.canvas);
        this.sceneFrame.appendChild(this.overlayNode);
        this.sceneFrame.appendChild(this.tooltipNode);
        this.sceneFrame.appendChild(this.legendNode);
        this.root.appendChild(this.headerNode);
        this.root.appendChild(this.sceneFrame);
        this.root.appendChild(this.badgesNode);
        this.root.appendChild(this.statusNode);
        this.root.appendChild(this.detailsNode);
        this.root.appendChild(this.footerNode);
        options.element.appendChild(this.root);

        this.bindSceneInteractions();
        this.startAnimation();
    }

    public update(options: VisualUpdateOptions): void {
        this.host.eventService.renderingStarted(options);
        this.viewport = options.viewport;
        this.dataView = options.dataViews?.[0];
        this.allowInteractions = this.host.hostCapabilities.allowInteractions !== false;
        this.lastOperationKindLabel = describeOperationKind(options.operationKind);
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            this.dataView
        );
        this.parsed = parseDataView(this.dataView);
        this.prepareFormattingSettingsModel();
        this.updateFetchStatusFromOperation(options.operationKind);
        this.maybeFetchMoreData();
        this.renderUi();
        this.renderScene();
        this.host.eventService.renderingFinished(options);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        this.prepareFormattingSettingsModel();
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy(): void {
        if (this.animationHandle) {
            window.cancelAnimationFrame(this.animationHandle);
        }
        this.webglRenderer?.destroy();
    }

    private prepareFormattingSettingsModel(): void {
        if (!this.formattingSettings) {
            return;
        }

        const totalsSelector = dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.TotalsOnly);
        const instanceSelector = dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals);

        this.enableConditionalColorFormatting(this.formattingSettings.markersCard.defaultColor, totalsSelector);

        this.formattingSettings.sceneCard.slices = [
            this.formattingSettings.sceneCard.backgroundColor,
            this.formattingSettings.sceneCard.overlayBackgroundColor,
            this.formattingSettings.sceneCard.overlayTextColor
        ];
        this.formattingSettings.displayCard.slices = [
            this.formattingSettings.displayCard.showTitle,
            this.formattingSettings.displayCard.showSummary,
            this.formattingSettings.displayCard.showOverlay,
            this.formattingSettings.displayCard.showBadges,
            this.formattingSettings.displayCard.showStatus,
            this.formattingSettings.displayCard.showFooter
        ];
        this.formattingSettings.textCard.slices = [
            this.formattingSettings.textCard.titleColor,
            this.formattingSettings.textCard.summaryColor,
            this.formattingSettings.textCard.statusColor,
            this.formattingSettings.textCard.footerColor,
            this.formattingSettings.textCard.badgeTextColor,
            this.formattingSettings.textCard.badgeBackgroundColor
        ];
        this.formattingSettings.axesCard.slices = [
            this.formattingSettings.axesCard.showAxes,
            this.formattingSettings.axesCard.showGrid,
            this.formattingSettings.axesCard.gridColor,
            this.formattingSettings.axesCard.axisXColor,
            this.formattingSettings.axesCard.axisYColor,
            this.formattingSettings.axesCard.axisZColor
        ];
        this.formattingSettings.legendCard.slices = [
            this.formattingSettings.legendCard.showLegend,
            this.formattingSettings.legendCard.showLegendTitle,
            this.formattingSettings.legendCard.legendMaxItems,
            this.formattingSettings.legendCard.legendFontSize,
            this.formattingSettings.legendCard.legendTextColor,
            this.formattingSettings.legendCard.legendTitleColor,
            this.formattingSettings.legendCard.legendBackgroundColor
        ];
        this.formattingSettings.markersCard.slices = [
            this.formattingSettings.markersCard.defaultColor,
            ...this.buildCategoryColorSlices(instanceSelector),
            this.formattingSettings.markersCard.markerSize,
            this.formattingSettings.markersCard.pointSizeScale,
            this.formattingSettings.markersCard.opacity
        ];
    }

    private enableConditionalColorFormatting(
        slice: formattingSettings.ColorPicker,
        selector: powerbi.data.Selector,
        altConstantSelector?: powerbi.data.Selector
    ): void {
        slice.selector = selector;
        slice.altConstantSelector = altConstantSelector;
        slice.instanceKind = powerbi.VisualEnumerationInstanceKinds.ConstantOrRule;
    }

    private buildCategoryColorSlices(selector: powerbi.data.Selector): FormattingSettingsSlice[] {
        const categoryColumn = this.findCategoryColumn(this.dataView);
        if (!categoryColumn) {
            return [];
        }

        const seen = new Set<string>();
        const slices: FormattingSettingsSlice[] = [];
        for (const point of this.parsed.points) {
            if (point.category === undefined) {
                continue;
            }

            const selectionId = this.host.createSelectionIdBuilder().withCategory(categoryColumn, point.sourceIndex).createSelectionId();
            const altConstantSelector = selectionIdToSelector(selectionId);
            const sliceKey = selectionKey(selectionId) ?? `${point.sourceIndex}:${String(point.category)}`;
            if (seen.has(sliceKey)) {
                continue;
            }

            seen.add(sliceKey);
            const slice = new formattingSettings.ColorPicker({
                name: "defaultColor",
                displayName: String(point.category),
                value: { value: point.markerColor ?? this.colorPalette.getColor(String(point.category)).value ?? this.resolveMarkerDefaultColor() }
            });
            this.enableConditionalColorFormatting(slice, selector, altConstantSelector);
            slices.push(slice);
        }

        return slices;
    }

    private renderUi(): void {
        const displayPoints = this.getDisplayPoints();
        const showHostDiagnostics = this.formattingSettings?.diagnosticsCard?.showHostDiagnostics?.value ?? false;
        const showTitle = this.formattingSettings?.displayCard?.showTitle?.value ?? false;
        const showSummary = this.formattingSettings?.displayCard?.showSummary?.value ?? false;
        const showBadges = this.formattingSettings?.displayCard?.showBadges?.value ?? false;
        const showStatus = this.formattingSettings?.displayCard?.showStatus?.value ?? false;
        const showFooter = this.formattingSettings?.displayCard?.showFooter?.value ?? false;
        this.titleNode.style.color = this.resolveVisualColor(this.formattingSettings?.textCard?.titleColor?.value?.value, "#f8fafc");
        this.summaryNode.style.color = this.resolveVisualColor(this.formattingSettings?.textCard?.summaryColor?.value?.value, "#dbe4f0");
        this.statusNode.style.color = this.resolveVisualColor(this.formattingSettings?.textCard?.statusColor?.value?.value, "#dbe4f0");
        this.footerNode.style.color = this.resolveVisualColor(this.formattingSettings?.textCard?.footerColor?.value?.value, "#c3d3e6");
        this.summaryNode.textContent = this.text("Visual_Summary");
        this.titleNode.textContent = this.text("Visual_Title");
        this.sceneFrame.setAttribute("aria-label", this.text("Visual_Aria_Scene_Count", displayPoints.length.toString()));
        this.sceneFrame.tabIndex = this.allowInteractions ? 0 : -1;
        this.footerNode.textContent = this.allowInteractions ? this.text("Visual_Footer") : this.text("Visual_Footer_ReadOnly");
        this.titleNode.hidden = !showTitle;
        this.summaryNode.hidden = !showSummary;
        this.headerNode.hidden = !showTitle && !showSummary;
        this.badgesNode.hidden = !showBadges;
        this.statusNode.hidden = !showStatus;
        this.footerNode.hidden = !showFooter;
        this.detailsNode.hidden = !showHostDiagnostics;

        this.replaceChildren(
            this.badgesNode,
            this.makeBadge(this.text("Visual_Badge_Rows", this.parsed.pointCount.toString())),
            this.makeBadge(this.text("Visual_Badge_Renderable", `${displayPoints.length}/${this.parsed.validPointCount}`)),
            this.makeBadge(this.text("Visual_Badge_Selected", this.selectedKeys.size.toString())),
            this.makeBadge(this.text("Visual_Badge_Axes", ["x", "y", "z"].filter((role) => this.parsed.fields[role]).length.toString())),
            this.makeBadge(this.text("Visual_Badge_Yaw", this.orbit.yaw.toFixed(2))),
            this.makeBadge(this.allowInteractions ? this.text("Visual_Badge_Mode_Interactive") : this.text("Visual_Badge_Mode_ReadOnly")),
            this.makeBadge(this.colorPalette.isHighContrast ? this.text("Visual_Badge_Mode_HC") : this.text("Visual_Badge_Mode_Palette")),
            this.makeBadge(this.text("Visual_Badge_Zoom", this.orbit.distance.toFixed(2)))
        );

        if (this.parsed.missingRequiredRoles.length > 0) {
            this.statusNode.textContent = this.text("Visual_Status_Missing");
        } else if (displayPoints.length === 0) {
            this.statusNode.textContent = this.text("Visual_Status_Empty");
        } else if (!this.allowInteractions) {
            this.statusNode.textContent = this.text("Visual_Status_ReadOnly");
        } else if (displayPoints.length < this.parsed.validPointCount) {
            this.statusNode.textContent = this.text("Visual_Status_Downsampled", displayPoints.length.toString(), this.parsed.validPointCount.toString());
        } else if (this.parsed.highlightCount > 0) {
            this.statusNode.textContent = this.text("Visual_Status_Highlight");
        } else if (!this.findCategoryColumn(this.dataView)) {
            this.statusNode.textContent = this.text("Visual_Status_NoCategory");
        } else {
            this.statusNode.textContent = this.text("Visual_Status_Ready");
        }

        const detailItems = [
            `X: ${this.parsed.fields.x ?? "Not bound"}`,
            `Y: ${this.parsed.fields.y ?? "Not bound"}`,
            `Z: ${this.parsed.fields.z ?? "Not bound"}`,
            `Size: ${this.parsed.fields.size ?? "Not bound"}`,
            `Category: ${this.parsed.fields.category ?? "Not bound"}`,
            `Render budget: ${displayPoints.length}/${this.parsed.validPointCount || 0}`,
            `Renderer: ${this.getRendererLabel()}`
        ].map((text) => this.makeListItem(text));

        if (showHostDiagnostics) {
            detailItems.push(this.makeListItem(`Visual version: ${VISUAL_VERSION}`));
            detailItems.push(this.makeListItem(`Host interactions: ${this.allowInteractions ? "enabled" : "disabled"}`));
            detailItems.push(this.makeListItem(`Update operation: ${this.lastOperationKindLabel}`));
            detailItems.push(this.makeListItem(`Fetch state: ${this.fetchStatus}`));
            detailItems.push(this.makeListItem(`WebGL active: ${this.webglRenderer?.isSupported ? "yes" : "no"}`));
        }

        this.replaceChildren(this.detailsNode, ...detailItems);
    }

    private renderScene(): void {
        const width = Math.max(280, this.viewport.width - 36);
        const height = Math.max(280, Math.min(560, this.viewport.height - 220));
        const devicePixelRatio = window.devicePixelRatio || 1;
        const displayPoints = this.getDisplayPoints();
        const showOverlay = this.formattingSettings?.displayCard?.showOverlay?.value ?? false;
        const backgroundColor = this.colorPalette.isHighContrast
            ? this.colorPalette.background.value
            : this.formattingSettings?.sceneCard?.backgroundColor?.value?.value ?? "transparent";
        const overlayBackgroundColor = this.resolveVisualColor(this.formattingSettings?.sceneCard?.overlayBackgroundColor?.value?.value, "#09101d");
        const overlayTextColor = this.resolveVisualColor(this.formattingSettings?.sceneCard?.overlayTextColor?.value?.value, "#dbe4f0");
        const showAxes = this.formattingSettings?.axesCard?.showAxes?.value ?? true;
        const showGrid = this.formattingSettings?.axesCard?.showGrid?.value ?? true;
        const gridColor = this.resolveVisualColor(this.formattingSettings?.axesCard?.gridColor?.value?.value, "#94a3b8");
        const showLegend = this.formattingSettings?.legendCard?.showLegend?.value ?? true;
        const axisXColor = this.colorPalette.isHighContrast
            ? this.colorPalette.foreground.value
            : this.formattingSettings?.axesCard?.axisXColor?.value?.value ?? "#38bdf8";
        const axisYColor = this.colorPalette.isHighContrast
            ? this.colorPalette.foreground.value
            : this.formattingSettings?.axesCard?.axisYColor?.value?.value ?? "#f97316";
        const axisZColor = this.colorPalette.isHighContrast
            ? this.colorPalette.foreground.value
            : this.formattingSettings?.axesCard?.axisZColor?.value?.value ?? "#22c55e";
        const defaultColor = this.resolveMarkerDefaultColor();
        const opacity = clamp((this.formattingSettings?.markersCard?.opacity?.value ?? 85) / 100, 0.15, 1);
        const markerSizeSetting = this.formattingSettings?.markersCard?.markerSize?.value ?? 6;
        const pointSizeScale = Math.max(0.1, this.formattingSettings?.markersCard?.pointSizeScale?.value ?? 1);
        const legendTextColor = this.resolveVisualColor(this.formattingSettings?.legendCard?.legendTextColor?.value?.value, "#dbe4f0");
        const legendTitleColor = this.resolveVisualColor(this.formattingSettings?.legendCard?.legendTitleColor?.value?.value, "#f8fafc");
        const legendBackgroundColor = this.resolveVisualColor(this.formattingSettings?.legendCard?.legendBackgroundColor?.value?.value, "#09101d");
        const badgeTextColor = this.resolveVisualColor(this.formattingSettings?.textCard?.badgeTextColor?.value?.value, "#dbe4f0");
        const badgeBackgroundColor = this.resolveVisualColor(this.formattingSettings?.textCard?.badgeBackgroundColor?.value?.value, "#0f172a");

        this.root.style.color = this.colorPalette.isHighContrast ? this.colorPalette.foreground.value : "";
        this.root.style.background = "transparent";
        this.sceneFrame.style.borderColor = this.colorPalette.isHighContrast ? this.colorPalette.foreground.value : "";
        this.sceneFrame.style.background = "transparent";
        this.overlayNode.style.color = overlayTextColor;
        this.overlayNode.style.background = overlayBackgroundColor;
        this.tooltipNode.style.background = this.colorPalette.isHighContrast ? this.colorPalette.background.value : overlayBackgroundColor;
        this.tooltipNode.style.borderColor = this.colorPalette.isHighContrast ? this.colorPalette.foreground.value : "";
        this.tooltipNode.style.color = overlayTextColor;
        this.legendNode.style.color = legendTextColor;
        this.legendNode.style.background = legendBackgroundColor;
        this.badgesNode.style.color = badgeTextColor;
        this.badgesNode.style.setProperty("--scatter3d-badge-text", badgeTextColor);
        this.badgesNode.style.setProperty("--scatter3d-badge-background", withAlpha(badgeBackgroundColor, 0.42));

        this.overlayNode.textContent = displayPoints.length > 0
            ? this.allowInteractions ? this.text("Visual_Overlay_Interactive") : this.text("Visual_Overlay_ReadOnly")
            : this.parsed.pointCount === 0 ? this.text("Visual_Overlay_Landing") : this.text("Visual_Overlay_Empty");
        this.overlayNode.hidden = !showOverlay;

        if (this.parsed.missingRequiredRoles.length > 0 || displayPoints.length === 0) {
            this.renderedPoints = [];
            this.legendNode.hidden = true;
            this.hideTooltip();
            this.renderEmptyScene(width, height, devicePixelRatio, backgroundColor, this.parsed.pointCount === 0);
            return;
        }

        const summary = summarizeScene(displayPoints);
        const categoryColumn = this.findCategoryColumn(this.dataView);
        const renderedPoints = summary.normalizedPoints
            .map((normalizedPoint, index) =>
                this.buildRenderedPoint(
                    displayPoints[index],
                    normalizedPoint,
                    categoryColumn,
                    width,
                    height,
                    markerSizeSetting,
                    pointSizeScale,
                    defaultColor,
                    opacity,
                    clamp((this.formattingSettings?.selectionCard?.selectedOpacity?.value ?? 100) / 100, 0.15, 1),
                    clamp((this.formattingSettings?.selectionCard?.unselectedOpacity?.value ?? 24) / 100, 0.05, 1),
                    clamp((this.formattingSettings?.selectionCard?.highlightOpacity?.value ?? 100) / 100, 0.15, 1)
                )
            )
            .sort((left, right) => right.depth - left.depth);

        if (showLegend) {
            this.renderLegend(defaultColor, displayPoints, legendTextColor, legendTitleColor, legendBackgroundColor);
        } else {
            this.legendNode.hidden = true;
        }

        if (!this.renderWebglScene(renderedPoints, width, height, devicePixelRatio, backgroundColor, showAxes, markerSizeSetting, pointSizeScale, defaultColor, axisXColor, axisYColor, axisZColor)) {
            this.renderCanvasScene(renderedPoints, width, height, devicePixelRatio, backgroundColor, showAxes, showGrid, gridColor, axisXColor, axisYColor, axisZColor);
        }
    }

    private buildRenderedPoint(
        point: ScatterPoint,
        normalizedPoint: { x: number; y: number; z: number; size: number },
        categoryColumn: DataViewCategoryColumn | undefined,
        width: number,
        height: number,
        markerSizeSetting: number,
        pointSizeScale: number,
        defaultColor: string,
        opacity: number,
        selectedOpacity: number,
        unselectedOpacity: number,
        highlightOpacity: number
    ): RenderedPoint & { depth: number } {
        const projected = projectPoint(normalizedPoint, this.orbit);
        const screenX = width / 2 + projected.x * width * 0.22;
        const screenY = height / 2 - projected.y * height * 0.22;
        const radius = projected.size * pointSizeScale + markerSizeSetting * 0.15;
        const categoryColor = point.category !== undefined ? this.colorPalette.getColor(String(point.category)).value : undefined;
        const baseFill = this.colorPalette.isHighContrast
            ? this.colorPalette.foreground.value
            : point.markerColor ?? categoryColor ?? defaultColor;
        const selectionId = categoryColumn
            ? this.host.createSelectionIdBuilder().withCategory(categoryColumn, point.sourceIndex).createSelectionId()
            : undefined;
        const key = selectionId ? selectionKey(selectionId) : undefined;
        const isSelected = key ? this.selectedKeys.has(key) : false;
        const alpha = isSelected
            ? selectedOpacity
            : this.selectedKeys.size > 0
                ? Math.min(opacity, unselectedOpacity)
                : point.hasHighlight
                    ? highlightOpacity
                    : this.parsed.highlightCount > 0
                        ? Math.min(opacity, unselectedOpacity)
                        : opacity;

        return {
            point,
            screenX,
            screenY,
            radius,
            fill: withAlpha(baseFill, alpha),
            selectionKey: key,
            selectionId,
            depth: projected.depth
        };
    }

    private renderWebglScene(
        renderedPoints: Array<RenderedPoint & { depth: number }>,
        width: number,
        height: number,
        devicePixelRatio: number,
        backgroundColor: string,
        showAxes: boolean,
        markerSizeSetting: number,
        pointSizeScale: number,
        defaultColor: string,
        axisXColor: string,
        axisYColor: string,
        axisZColor: string
    ): boolean {
        const renderer = this.getWebglRenderer();
        if (!renderer?.isSupported) {
            return false;
        }

        renderer.resize({ width, height, devicePixelRatio });
        renderer.setFrame({
            points: renderedPoints.map((renderedPoint) => ({
                id: String(renderedPoint.point.sourceIndex),
                position: [renderedPoint.point.x, renderedPoint.point.y, renderedPoint.point.z],
                size: renderedPoint.radius,
                color: renderedPoint.fill,
                selected: renderedPoint.selectionKey ? this.selectedKeys.has(renderedPoint.selectionKey) : false,
                highlighted: renderedPoint.point.hasHighlight,
                payload: {
                    point: renderedPoint.point,
                    fill: renderedPoint.fill,
                    selectionKey: renderedPoint.selectionKey,
                    selectionId: renderedPoint.selectionId
                } as WebglPayload
            })),
            camera: this.orbit,
            viewport: { width, height, devicePixelRatio },
            axes: showAxes ? undefined : [],
            appearance: {
                backgroundColor,
                pointColor: defaultColor,
                pointOpacity: 1,
                selectedOpacity: 1,
                highlightOpacity: 1,
                axisOpacity: this.colorPalette.isHighContrast ? 1 : 0.78,
                axisXColor,
                axisYColor,
                axisZColor,
                basePointSize: Math.max(2.5, markerSizeSetting * 0.5),
                sizeScale: Math.max(1, pointSizeScale * 4.4),
                sceneScale: 0.44
            }
        });
        renderer.render();

        const frame = renderer.currentFrame;
        if (!frame) {
            return false;
        }

        this.renderedPoints = frame.points
            .map((point) => {
                if (!isWebglPayload(point.payload)) {
                    return undefined;
                }

                return {
                    point: point.payload.point,
                    screenX: point.screenX,
                    screenY: point.screenY,
                    radius: point.size / 2,
                    fill: point.payload.fill,
                    selectionKey: point.payload.selectionKey,
                    selectionId: point.payload.selectionId
                };
            })
            .filter(isDefined);

        return true;
    }

    private renderCanvasScene(
        renderedPoints: Array<RenderedPoint & { depth: number }>,
        width: number,
        height: number,
        devicePixelRatio: number,
        backgroundColor: string,
        showAxes: boolean,
        showGrid: boolean,
        gridColor: string,
        axisXColor: string,
        axisYColor: string,
        axisZColor: string
    ): void {
        this.canvas.width = Math.round(width * devicePixelRatio);
        this.canvas.height = Math.round(height * devicePixelRatio);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        const context = this.getCanvas2DContext();
        if (!context) {
            return;
        }

        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, width, height);
        if (showGrid) {
            this.drawGrid(context, width, height, gridColor);
        }

        if (showAxes) {
            this.drawAxes(context, width, height, axisXColor, axisYColor, axisZColor);
        }

        this.renderedPoints = renderedPoints.map(({ depth: _depth, ...point }) => point);
        this.renderedPoints.forEach((renderedPoint) => {
            const isSelected = renderedPoint.selectionKey ? this.selectedKeys.has(renderedPoint.selectionKey) : false;
            const isHovered = this.hoveredPoint === renderedPoint;
            const stroke = this.colorPalette.isHighContrast
                ? isSelected ? this.colorPalette.foregroundSelected.value : this.colorPalette.foreground.value
                : isSelected ? "rgba(255,255,255,0.95)" : isHovered ? "rgba(255,255,255,0.8)" : "rgba(15, 23, 42, 0.35)";

            context.beginPath();
            context.fillStyle = renderedPoint.fill;
            context.shadowBlur = this.colorPalette.isHighContrast ? 0 : isSelected ? 22 : isHovered ? 18 : 14;
            context.shadowColor = this.colorPalette.isHighContrast ? stroke : withAlpha(renderedPoint.fill, isSelected ? 0.5 : 0.25);
            context.arc(renderedPoint.screenX, renderedPoint.screenY, renderedPoint.radius, 0, Math.PI * 2);
            context.fill();
            context.lineWidth = isSelected ? 2.5 : isHovered ? 2 : renderedPoint.point.hasHighlight ? 1.6 : 1;
            context.strokeStyle = stroke;
            context.stroke();
        });

        context.shadowBlur = 0;
        context.strokeStyle = this.colorPalette.isHighContrast ? this.colorPalette.foreground.value : "rgba(148, 163, 184, 0.25)";
        context.strokeRect(12, 12, width - 24, height - 24);
    }

    private renderEmptyScene(width: number, height: number, devicePixelRatio: number, backgroundColor: string, isLandingPage: boolean): void {
        const renderer = this.getWebglRenderer();
        if (renderer?.isSupported) {
            renderer.resize({ width, height, devicePixelRatio });
            renderer.setFrame({
                points: [],
                camera: this.orbit,
                viewport: { width, height, devicePixelRatio },
                axes: [],
                appearance: { backgroundColor }
            });
            renderer.render();
            return;
        }

        this.canvas.width = Math.round(width * devicePixelRatio);
        this.canvas.height = Math.round(height * devicePixelRatio);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        const context = this.getCanvas2DContext();
        if (!context) {
            return;
        }

        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, width, height);
        this.drawEmptyState(context, width, height, isLandingPage);
    }

    private renderLegend(
        fallbackColor: string,
        points: ScatterPoint[],
        legendTextColor: string,
        legendTitleColor: string,
        legendBackgroundColor: string
    ): void {
        const showLegendTitle = this.formattingSettings?.legendCard?.showLegendTitle?.value ?? true;
        const legendFontSize = Math.max(10, Math.floor(this.formattingSettings?.legendCard?.legendFontSize?.value ?? 12));
        const legendItems = this.buildLegendItems(fallbackColor, points);
        this.legendNode.hidden = legendItems.length === 0;
        this.legendNode.style.fontSize = `${legendFontSize}px`;
        this.legendNode.style.color = legendTextColor;
        this.legendNode.style.background = legendBackgroundColor;
        while (this.legendNode.firstChild) {
            this.legendNode.removeChild(this.legendNode.firstChild);
        }

        if (showLegendTitle) {
            const title = document.createElement("div");
            title.className = "scatter3d__legend-title";
            title.textContent = this.text("Legend_Title_Category");
            title.style.color = legendTitleColor;
            this.legendNode.appendChild(title);
        }

        legendItems.forEach((item) => {
            const row = document.createElement("div");
            row.className = "scatter3d__legend-item";
            const swatch = document.createElement("span");
            swatch.className = "scatter3d__legend-swatch";
            swatch.style.background = item.color;
            swatch.style.borderColor = this.colorPalette.isHighContrast ? this.colorPalette.foreground.value : item.color;
            const label = document.createElement("span");
            label.className = "scatter3d__legend-label";
            label.textContent = item.label;
            label.style.color = legendTextColor;
            row.appendChild(swatch);
            row.appendChild(label);
            this.legendNode.appendChild(row);
        });
    }

    private buildLegendItems(fallbackColor: string, points: ScatterPoint[]): LegendItem[] {
        const legendMaxItems = Math.max(1, Math.floor(this.formattingSettings?.legendCard?.legendMaxItems?.value ?? 6));
        const items = new Map<string, LegendItem>();
        points.forEach((point) => {
            if (point.category === undefined || items.size >= legendMaxItems) {
                return;
            }

            const label = String(point.category);
            if (items.has(label)) {
                return;
            }

            const color = this.colorPalette.isHighContrast
                ? this.colorPalette.foreground.value
                : point.markerColor ?? (this.colorPalette.getColor(label).value || fallbackColor);
            items.set(label, { label, color });
        });
        return Array.from(items.values());
    }

    private drawEmptyState(context: CanvasRenderingContext2D, width: number, height: number, isLandingPage: boolean): void {
        context.strokeStyle = this.colorPalette.isHighContrast ? this.colorPalette.foreground.value : "rgba(148, 163, 184, 0.18)";
        context.setLineDash([8, 8]);
        context.strokeRect(32, 32, width - 64, height - 64);
        context.setLineDash([]);
        context.fillStyle = this.resolveVisualColor(this.formattingSettings?.textCard?.titleColor?.value?.value, "#dbe4f0");
        context.font = "600 18px Segoe UI";
        context.fillText(this.text(isLandingPage ? "Visual_Landing_Title" : "Visual_Empty_Title"), 48, height / 2 - 6);
        context.font = "14px Segoe UI";
        context.fillStyle = this.resolveVisualColor(this.formattingSettings?.textCard?.summaryColor?.value?.value, "#c3d3e6");
        context.fillText(this.text(isLandingPage ? "Visual_Landing_Subtitle" : "Visual_Empty_Subtitle"), 48, height / 2 + 20);
    }

    private drawGrid(context: CanvasRenderingContext2D, width: number, height: number, gridColor: string): void {
        context.strokeStyle = this.colorPalette.isHighContrast ? withAlpha(this.colorPalette.foreground.value, 0.35) : withAlpha(gridColor, 0.18);
        context.lineWidth = 1;
        for (let index = 1; index < 5; index += 1) {
            const t = index / 5;
            context.beginPath();
            context.moveTo(24, height * t);
            context.lineTo(width - 24, height * t);
            context.stroke();
        }
    }

    private drawAxes(context: CanvasRenderingContext2D, width: number, height: number, axisXColor: string, axisYColor: string, axisZColor: string): void {
        const axes = [
            { label: "X", end: { x: 1, y: 0, z: 0 }, color: axisXColor },
            { label: "Y", end: { x: 0, y: 1, z: 0 }, color: axisYColor },
            { label: "Z", end: { x: 0, y: 0, z: 1 }, color: axisZColor }
        ];

        axes.forEach((axis) => {
            const start = projectPoint({ x: 0, y: 0, z: 0, size: 0.4 }, this.orbit);
            const end = projectPoint({ ...axis.end, size: 0.4 }, this.orbit);
            const startX = width / 2 + start.x * width * 0.22;
            const startY = height / 2 - start.y * height * 0.22;
            const endX = width / 2 + end.x * width * 0.22;
            const endY = height / 2 - end.y * height * 0.22;

            context.strokeStyle = this.colorPalette.isHighContrast ? this.colorPalette.foreground.value : axis.color;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(endX, endY);
            context.stroke();

            context.fillStyle = this.colorPalette.isHighContrast ? this.colorPalette.foreground.value : axis.color;
            context.font = "600 12px Segoe UI";
            context.fillText(axis.label, endX + 8, endY - 6);
        });
    }

    private bindSceneInteractions(): void {
        this.canvas.addEventListener("pointerdown", (event) => {
            if (!this.allowInteractions) {
                return;
            }

            this.isDragging = true;
            this.dragOrigin = {
                x: event.clientX,
                y: event.clientY,
                yaw: this.orbit.yaw,
                pitch: this.orbit.pitch
            };
            this.canvas.setPointerCapture(event.pointerId);
        });

        this.canvas.addEventListener("pointermove", (event) => {
            if (this.isDragging && this.dragOrigin) {
                const orbitSensitivity = clamp(this.formattingSettings?.cameraCard?.orbitSensitivity?.value ?? 1, 0.25, 4);
                this.orbit.yaw = this.dragOrigin.yaw + (event.clientX - this.dragOrigin.x) * 0.01 * orbitSensitivity;
                this.orbit.pitch = clamp(this.dragOrigin.pitch + (event.clientY - this.dragOrigin.y) * 0.01 * orbitSensitivity, -1.1, 1.1);
                this.renderUi();
                this.renderScene();
                this.hideTooltip();
                return;
            }

            const hoveredPoint = this.hitTest(event.offsetX, event.offsetY);
            if (hoveredPoint !== this.hoveredPoint) {
                this.hoveredPoint = hoveredPoint;
                this.renderScene();
            }

            if (hoveredPoint) {
                this.showTooltip(hoveredPoint, { x: event.offsetX, y: event.offsetY });
            } else {
                this.hideTooltip();
            }
        });

        const releaseDrag = (event?: PointerEvent): void => {
            const dragDistance = this.dragOrigin
                ? distance2D(this.dragOrigin.x, this.dragOrigin.y, event?.clientX ?? this.dragOrigin.x, event?.clientY ?? this.dragOrigin.y)
                : 0;
            const wasDragging = this.isDragging && dragDistance > 5;
            this.isDragging = false;
            this.dragOrigin = undefined;
            if (!wasDragging && event) {
                void this.handlePointSelection(event);
            }
        };

        this.canvas.addEventListener("pointerup", (event) => releaseDrag(event));
        this.canvas.addEventListener("pointerleave", () => {
            this.isDragging = false;
            this.dragOrigin = undefined;
            this.hideTooltip();
        });

        this.canvas.addEventListener("wheel", (event) => {
            if (!this.allowInteractions) {
                return;
            }

            event.preventDefault();
            const zoomSensitivity = clamp(this.formattingSettings?.cameraCard?.zoomSensitivity?.value ?? 1, 0.25, 4);
            this.orbit.distance = clamp(this.orbit.distance + event.deltaY * 0.003 * zoomSensitivity, 2.8, 8);
            this.renderUi();
            this.renderScene();
        });

        this.canvas.addEventListener("contextmenu", (event) => {
            if (!this.allowInteractions) {
                return;
            }

            event.preventDefault();
            const hit = this.hitTest(event.offsetX, event.offsetY);
            void this.selectionManager.showContextMenu(hit?.selectionId ?? ({} as ISelectionId), { x: event.clientX, y: event.clientY });
        });

        this.sceneFrame.addEventListener("keydown", (event) => {
            if (!this.allowInteractions) {
                return;
            }

            switch (event.key) {
                case "ArrowLeft":
                    this.orbit.yaw -= 0.08 * clamp(this.formattingSettings?.cameraCard?.orbitSensitivity?.value ?? 1, 0.25, 4);
                    break;
                case "ArrowRight":
                    this.orbit.yaw += 0.08 * clamp(this.formattingSettings?.cameraCard?.orbitSensitivity?.value ?? 1, 0.25, 4);
                    break;
                case "ArrowUp":
                    this.orbit.pitch = clamp(this.orbit.pitch - 0.08 * clamp(this.formattingSettings?.cameraCard?.orbitSensitivity?.value ?? 1, 0.25, 4), -1.1, 1.1);
                    break;
                case "ArrowDown":
                    this.orbit.pitch = clamp(this.orbit.pitch + 0.08 * clamp(this.formattingSettings?.cameraCard?.orbitSensitivity?.value ?? 1, 0.25, 4), -1.1, 1.1);
                    break;
                case "+":
                case "=":
                    this.orbit.distance = clamp(this.orbit.distance - 0.2 * clamp(this.formattingSettings?.cameraCard?.zoomSensitivity?.value ?? 1, 0.25, 4), 2.8, 8);
                    break;
                case "-":
                case "_":
                    this.orbit.distance = clamp(this.orbit.distance + 0.2 * clamp(this.formattingSettings?.cameraCard?.zoomSensitivity?.value ?? 1, 0.25, 4), 2.8, 8);
                    break;
                case "Escape":
                    void this.selectionManager.clear();
                    this.selectedKeys = new Set<string>();
                    break;
                default:
                    return;
            }

            this.renderUi();
            this.renderScene();
            event.preventDefault();
        });
    }

    private async handlePointSelection(event: PointerEvent): Promise<void> {
        if (!this.allowInteractions) {
            return;
        }

        const hit = this.hitTest(event.offsetX, event.offsetY);
        if (!hit?.selectionId) {
            const clearSelectionOnBackground = this.formattingSettings?.selectionCard?.clearSelectionOnBackground?.value ?? true;
            if (clearSelectionOnBackground) {
                await this.selectionManager.clear();
                this.selectedKeys = new Set<string>();
            }
        } else {
            const selected = await this.selectionManager.select(hit.selectionId, event.ctrlKey || event.metaKey);
            this.selectedKeys = new Set(selected.map((id) => selectionKey(id)).filter(isDefined));
        }

        this.renderUi();
        this.renderScene();
    }

    private showTooltip(renderedPoint: RenderedPoint, position: { x: number; y: number }): void {
        const dataItems = renderedPoint.point.tooltipItems.length > 0
            ? renderedPoint.point.tooltipItems
            : [{ displayName: "Point", value: `${renderedPoint.point.x}, ${renderedPoint.point.y}, ${renderedPoint.point.z}` }];

        const visualTooltipItems: VisualTooltipDataItem[] = dataItems.map((item) => ({
            displayName: item.displayName,
            value: item.value,
            color: renderedPoint.fill
        }));

        this.tooltipNode.hidden = false;
        this.tooltipNode.style.left = `${position.x + 18}px`;
        this.tooltipNode.style.top = `${position.y + 18}px`;
        while (this.tooltipNode.firstChild) {
            this.tooltipNode.removeChild(this.tooltipNode.firstChild);
        }

        dataItems.forEach((item) => {
            const row = document.createElement("div");
            row.className = "scatter3d__tooltip-row";
            const label = document.createElement("span");
            label.textContent = item.displayName;
            const value = document.createElement("strong");
            value.textContent = item.value;
            row.appendChild(label);
            row.appendChild(value);
            this.tooltipNode.appendChild(row);
        });

        if (this.host.tooltipService?.enabled()) {
            this.host.tooltipService.show({
                coordinates: [position.x + 24, position.y + 24],
                isTouchEvent: false,
                dataItems: visualTooltipItems,
                identities: renderedPoint.selectionId ? [renderedPoint.selectionId] : []
            });
        }
    }

    private hideTooltip(): void {
        this.tooltipNode.hidden = true;
        if (this.host.tooltipService?.enabled()) {
            this.host.tooltipService.hide({ isTouchEvent: false, immediately: true });
        }
    }

    private hitTest(x: number, y: number): RenderedPoint | undefined {
        let nearestPoint: RenderedPoint | undefined;
        let nearestDistance = Number.POSITIVE_INFINITY;
        this.renderedPoints.forEach((point) => {
            const distance = distance2D(point.screenX, point.screenY, x, y);
            if (distance <= point.radius + 6 && distance < nearestDistance) {
                nearestPoint = point;
                nearestDistance = distance;
            }
        });
        return nearestPoint;
    }

    private findCategoryColumn(dataView?: DataView): DataViewCategoryColumn | undefined {
        return dataView?.categorical?.categories?.find((column) => column.source.roles?.category);
    }

    private startAnimation(): void {
        const tick = (): void => {
            const autoRotate = this.formattingSettings?.cameraCard?.autoRotate?.value ?? true;
            const autoRotateSpeed = clamp(this.formattingSettings?.cameraCard?.autoRotateSpeed?.value ?? 0.5, 0, 5);
            if (autoRotate && !this.isDragging && this.parsed.validPointCount > 0) {
                this.orbit.yaw += 0.0035 * autoRotateSpeed;
                this.renderUi();
                this.renderScene();
            }

            this.animationHandle = window.requestAnimationFrame(tick);
        };

        this.animationHandle = window.requestAnimationFrame(tick);
    }

    private maybeFetchMoreData(): void {
        const autoFetchMoreData = this.formattingSettings?.performanceCard?.autoFetchMoreData?.value ?? false;
        if (!autoFetchMoreData) {
            return;
        }

        const fetchTriggerPointCount = Math.max(1000, Math.floor(this.formattingSettings?.performanceCard?.fetchTriggerPointCount?.value ?? 9000));
        const aggregateSegments = this.formattingSettings?.performanceCard?.aggregateSegments?.value ?? true;
        const isAppendLike = this.lastOperationKindLabel === "Append" || this.lastOperationKindLabel === "Segment";
        if (isAppendLike || this.parsed.pointCount < fetchTriggerPointCount) {
            return;
        }

        if (this.fetchRequestedPointCount === this.parsed.pointCount) {
            return;
        }

        const accepted = this.host.fetchMoreData?.(aggregateSegments) ?? false;
        this.fetchStatus = accepted
            ? `Requested more data at ${this.parsed.pointCount} rows`
            : "Fetch more data unavailable";
        if (accepted) {
            this.fetchRequestedPointCount = this.parsed.pointCount;
        }
    }

    private updateFetchStatusFromOperation(operationKind: powerbi.VisualDataChangeOperationKind | undefined): void {
        switch (operationKind) {
            case powerbi.VisualDataChangeOperationKind.Append:
                this.fetchStatus = `Append received: ${this.parsed.pointCount} rows`;
                break;
            case powerbi.VisualDataChangeOperationKind.Segment:
                this.fetchStatus = `Segment received: ${this.parsed.pointCount} rows`;
                break;
            case powerbi.VisualDataChangeOperationKind.Create:
            default:
                if (!this.fetchStatus || this.fetchStatus.startsWith("Append") || this.fetchStatus.startsWith("Segment")) {
                    this.fetchStatus = "Idle";
                }
                break;
        }
    }

    private getWebglRenderer(): WebGLSceneRenderer | null {
        if (this.webglRenderer !== undefined) {
            return this.webglRenderer;
        }

        try {
            const renderer = new WebGLSceneRenderer(this.canvas);
            this.webglRenderer = renderer.isSupported ? renderer : null;
            if (!renderer.isSupported) {
                renderer.destroy();
            }
        } catch {
            this.webglRenderer = null;
        }

        return this.webglRenderer;
    }

    private getCanvas2DContext(): CanvasRenderingContext2D | null {
        if (this.canvas2DContext !== undefined) {
            return this.canvas2DContext;
        }

        this.canvas2DContext = this.canvas.getContext("2d");
        return this.canvas2DContext;
    }

    private getDisplayPoints(): ScatterPoint[] {
        const downsampleDenseScenes = this.formattingSettings?.performanceCard?.downsampleDenseScenes?.value ?? true;
        const maxRenderedPoints = Math.max(1, Math.floor(this.formattingSettings?.performanceCard?.maxRenderedPoints?.value ?? 10000));
        return downsampleDenseScenes ? limitScenePoints(this.parsed.points, maxRenderedPoints) : this.parsed.points;
    }

    private getRendererLabel(): string {
        if (this.webglRenderer?.isSupported) {
            return "WebGL";
        }
        if (this.webglRenderer === null) {
            return "Canvas 2D";
        }
        return "Auto-detect";
    }

    private resolveVisualColor(color: string | undefined, fallback: string): string {
        if (this.colorPalette.isHighContrast) {
            return this.colorPalette.foreground.value;
        }

        return color ?? fallback;
    }

    private resolveMarkerDefaultColor(): string {
        return this.colorPalette.isHighContrast
            ? this.colorPalette.foreground.value
            : this.formattingSettings?.markersCard?.defaultColor?.value?.value ?? "#38bdf8";
    }

    private makeBadge(text: string): HTMLSpanElement {
        const badge = document.createElement("span");
        badge.className = "scatter3d__badge";
        badge.textContent = text;
        return badge;
    }

    private makeListItem(text: string): HTMLLIElement {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
    }

    private replaceChildren(node: HTMLElement, ...children: HTMLElement[]): void {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
        children.forEach((child) => node.appendChild(child));
    }

    private text(key: string, ...args: string[]): string {
        const template = this.localizationManager.getDisplayName(key) || key;
        return args.reduce((result, value, index) => result.replace(`{${index}}`, value), template);
    }
}

function withAlpha(color: string, alpha: number): string {
    if (color.startsWith("hsl(")) {
        return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
    }

    if (color.startsWith("#")) {
        const hex = color.slice(1);
        const normalized = hex.length === 3 ? hex.split("").map((part) => `${part}${part}`).join("") : hex;
        const red = Number.parseInt(normalized.slice(0, 2), 16);
        const green = Number.parseInt(normalized.slice(2, 4), 16);
        const blue = Number.parseInt(normalized.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    return color;
}

function selectionKey(id: unknown): string | undefined {
    if (typeof id === "object" && id && "getKey" in id && typeof (id as { getKey: () => string }).getKey === "function") {
        return (id as { getKey: () => string }).getKey();
    }
    return undefined;
}

function selectionIdToSelector(id: unknown): powerbi.data.Selector | undefined {
    if (typeof id === "object" && id && "getSelector" in id && typeof (id as { getSelector: () => powerbi.data.Selector }).getSelector === "function") {
        return (id as { getSelector: () => powerbi.data.Selector }).getSelector();
    }

    return undefined;
}

function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

function isWebglPayload(value: unknown): value is WebglPayload {
    return typeof value === "object" && value !== null && "point" in value && "fill" in value;
}

function describeOperationKind(operationKind: powerbi.VisualDataChangeOperationKind | undefined): string {
    switch (operationKind) {
        case powerbi.VisualDataChangeOperationKind.Append:
            return "Append";
        case powerbi.VisualDataChangeOperationKind.Segment:
            return "Segment";
        case powerbi.VisualDataChangeOperationKind.Create:
        default:
            return "Create";
    }
}
