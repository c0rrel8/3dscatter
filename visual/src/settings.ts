import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsModel = formattingSettings.Model;
import FormattingSettingsSlice = formattingSettings.Slice;

class SceneCardSettings extends FormattingSettingsCard {
    backgroundColor = new formattingSettings.ColorPicker({
        name: "backgroundColor",
        displayNameKey: "Property_BackgroundColor_DisplayName",
        displayName: "Background color",
        value: { value: "transparent" }
    });

    overlayBackgroundColor = new formattingSettings.ColorPicker({
        name: "overlayBackgroundColor",
        displayNameKey: "Property_OverlayBackgroundColor_DisplayName",
        displayName: "Overlay background color",
        value: { value: "#09101d" }
    });

    overlayTextColor = new formattingSettings.ColorPicker({
        name: "overlayTextColor",
        displayNameKey: "Property_OverlayTextColor_DisplayName",
        displayName: "Overlay text color",
        value: { value: "#dbe4f0" }
    });

    name = "scene";
    displayNameKey = "Object_Scene_DisplayName";
    displayName = "Scene";
    slices: Array<FormattingSettingsSlice> = [this.backgroundColor, this.overlayBackgroundColor, this.overlayTextColor];
}

class DisplayCardSettings extends FormattingSettingsCard {
    showTitle = new formattingSettings.ToggleSwitch({
        name: "showTitle",
        displayNameKey: "Property_ShowTitle_DisplayName",
        displayName: "Show title",
        value: false
    });

    showSummary = new formattingSettings.ToggleSwitch({
        name: "showSummary",
        displayNameKey: "Property_ShowSummary_DisplayName",
        displayName: "Show summary",
        value: false
    });

    showOverlay = new formattingSettings.ToggleSwitch({
        name: "showOverlay",
        displayNameKey: "Property_ShowOverlay_DisplayName",
        displayName: "Show overlay",
        value: false
    });

    showBadges = new formattingSettings.ToggleSwitch({
        name: "showBadges",
        displayNameKey: "Property_ShowBadges_DisplayName",
        displayName: "Show badges",
        value: false
    });

    showStatus = new formattingSettings.ToggleSwitch({
        name: "showStatus",
        displayNameKey: "Property_ShowStatus_DisplayName",
        displayName: "Show status",
        value: false
    });

    showFooter = new formattingSettings.ToggleSwitch({
        name: "showFooter",
        displayNameKey: "Property_ShowFooter_DisplayName",
        displayName: "Show footer",
        value: false
    });

    name = "display";
    displayNameKey = "Object_Display_DisplayName";
    displayName = "Display";
    slices: Array<FormattingSettingsSlice> = [
        this.showTitle,
        this.showSummary,
        this.showOverlay,
        this.showBadges,
        this.showStatus,
        this.showFooter
    ];
}

class TextCardSettings extends FormattingSettingsCard {
    titleColor = new formattingSettings.ColorPicker({
        name: "titleColor",
        displayNameKey: "Property_TitleColor_DisplayName",
        displayName: "Title color",
        value: { value: "#f8fafc" }
    });

    summaryColor = new formattingSettings.ColorPicker({
        name: "summaryColor",
        displayNameKey: "Property_SummaryColor_DisplayName",
        displayName: "Summary color",
        value: { value: "#dbe4f0" }
    });

    statusColor = new formattingSettings.ColorPicker({
        name: "statusColor",
        displayNameKey: "Property_StatusColor_DisplayName",
        displayName: "Status color",
        value: { value: "#dbe4f0" }
    });

    footerColor = new formattingSettings.ColorPicker({
        name: "footerColor",
        displayNameKey: "Property_FooterColor_DisplayName",
        displayName: "Footer color",
        value: { value: "#c3d3e6" }
    });

    badgeTextColor = new formattingSettings.ColorPicker({
        name: "badgeTextColor",
        displayNameKey: "Property_BadgeTextColor_DisplayName",
        displayName: "Badge text color",
        value: { value: "#dbe4f0" }
    });

    badgeBackgroundColor = new formattingSettings.ColorPicker({
        name: "badgeBackgroundColor",
        displayNameKey: "Property_BadgeBackgroundColor_DisplayName",
        displayName: "Badge background color",
        value: { value: "#0f172a" }
    });

    name = "text";
    displayNameKey = "Object_Text_DisplayName";
    displayName = "Text";
    slices: Array<FormattingSettingsSlice> = [
        this.titleColor,
        this.summaryColor,
        this.statusColor,
        this.footerColor,
        this.badgeTextColor,
        this.badgeBackgroundColor
    ];
}

class AxesCardSettings extends FormattingSettingsCard {
    showAxes = new formattingSettings.ToggleSwitch({
        name: "showAxes",
        displayNameKey: "Property_ShowAxes_DisplayName",
        displayName: "Show axes",
        value: true
    });

    showGrid = new formattingSettings.ToggleSwitch({
        name: "showGrid",
        displayNameKey: "Property_ShowGrid_DisplayName",
        displayName: "Show grid",
        value: true
    });

    gridColor = new formattingSettings.ColorPicker({
        name: "gridColor",
        displayNameKey: "Property_GridColor_DisplayName",
        displayName: "Grid color",
        value: { value: "#94a3b8" }
    });

    axisXColor = new formattingSettings.ColorPicker({
        name: "axisXColor",
        displayNameKey: "Property_AxisXColor_DisplayName",
        displayName: "X axis color",
        value: { value: "#38bdf8" }
    });

    axisYColor = new formattingSettings.ColorPicker({
        name: "axisYColor",
        displayNameKey: "Property_AxisYColor_DisplayName",
        displayName: "Y axis color",
        value: { value: "#f97316" }
    });

    axisZColor = new formattingSettings.ColorPicker({
        name: "axisZColor",
        displayNameKey: "Property_AxisZColor_DisplayName",
        displayName: "Z axis color",
        value: { value: "#22c55e" }
    });

    name = "axes";
    displayNameKey = "Object_Axes_DisplayName";
    displayName = "Axes";
    slices: Array<FormattingSettingsSlice> = [this.showAxes, this.showGrid, this.gridColor, this.axisXColor, this.axisYColor, this.axisZColor];
}

class LegendCardSettings extends FormattingSettingsCard {
    showLegend = new formattingSettings.ToggleSwitch({
        name: "showLegend",
        displayNameKey: "Property_ShowLegend_DisplayName",
        displayName: "Show legend",
        value: true
    });

    showLegendTitle = new formattingSettings.ToggleSwitch({
        name: "showLegendTitle",
        displayNameKey: "Property_ShowLegendTitle_DisplayName",
        displayName: "Show legend title",
        value: true
    });

    legendMaxItems = new formattingSettings.NumUpDown({
        name: "legendMaxItems",
        displayNameKey: "Property_LegendMaxItems_DisplayName",
        displayName: "Max legend items",
        value: 6
    });

    legendFontSize = new formattingSettings.NumUpDown({
        name: "legendFontSize",
        displayNameKey: "Property_LegendFontSize_DisplayName",
        displayName: "Legend font size",
        value: 12
    });

    legendTextColor = new formattingSettings.ColorPicker({
        name: "legendTextColor",
        displayNameKey: "Property_LegendTextColor_DisplayName",
        displayName: "Legend text color",
        value: { value: "#dbe4f0" }
    });

    legendTitleColor = new formattingSettings.ColorPicker({
        name: "legendTitleColor",
        displayNameKey: "Property_LegendTitleColor_DisplayName",
        displayName: "Legend title color",
        value: { value: "#f8fafc" }
    });

    legendBackgroundColor = new formattingSettings.ColorPicker({
        name: "legendBackgroundColor",
        displayNameKey: "Property_LegendBackgroundColor_DisplayName",
        displayName: "Legend background color",
        value: { value: "#09101d" }
    });

    name = "legend";
    displayNameKey = "Object_Legend_DisplayName";
    displayName = "Legend";
    slices: Array<FormattingSettingsSlice> = [
        this.showLegend,
        this.showLegendTitle,
        this.legendMaxItems,
        this.legendFontSize,
        this.legendTextColor,
        this.legendTitleColor,
        this.legendBackgroundColor
    ];
}

class MarkersCardSettings extends FormattingSettingsCard {
    defaultColor = new formattingSettings.ColorPicker({
        name: "defaultColor",
        displayNameKey: "Property_DefaultColor_DisplayName",
        displayName: "Default marker color",
        value: { value: "#38bdf8" }
    });

    markerSize = new formattingSettings.NumUpDown({
        name: "markerSize",
        displayNameKey: "Property_MarkerSize_DisplayName",
        displayName: "Marker size",
        value: 6
    });

    pointSizeScale = new formattingSettings.NumUpDown({
        name: "pointSizeScale",
        displayNameKey: "Property_PointSizeScale_DisplayName",
        displayName: "Point size scale",
        value: 1
    });

    opacity = new formattingSettings.NumUpDown({
        name: "opacity",
        displayNameKey: "Property_Opacity_DisplayName",
        displayName: "Marker opacity",
        value: 85
    });

    name = "markers";
    displayNameKey = "Object_Markers_DisplayName";
    displayName = "Markers";
    slices: Array<FormattingSettingsSlice> = [this.defaultColor, this.markerSize, this.pointSizeScale, this.opacity];
}

class SelectionCardSettings extends FormattingSettingsCard {
    selectedOpacity = new formattingSettings.NumUpDown({
        name: "selectedOpacity",
        displayNameKey: "Property_SelectedOpacity_DisplayName",
        displayName: "Selected point opacity",
        value: 100
    });

    unselectedOpacity = new formattingSettings.NumUpDown({
        name: "unselectedOpacity",
        displayNameKey: "Property_UnselectedOpacity_DisplayName",
        displayName: "Unselected point opacity",
        value: 24
    });

    highlightOpacity = new formattingSettings.NumUpDown({
        name: "highlightOpacity",
        displayNameKey: "Property_HighlightOpacity_DisplayName",
        displayName: "Highlight opacity",
        value: 100
    });

    clearSelectionOnBackground = new formattingSettings.ToggleSwitch({
        name: "clearSelectionOnBackground",
        displayNameKey: "Property_ClearSelectionOnBackground_DisplayName",
        displayName: "Clear selection on background click",
        value: true
    });

    name = "selection";
    displayNameKey = "Object_Selection_DisplayName";
    displayName = "Selection & Highlight";
    slices: Array<FormattingSettingsSlice> = [
        this.selectedOpacity,
        this.unselectedOpacity,
        this.highlightOpacity,
        this.clearSelectionOnBackground
    ];
}

class CameraCardSettings extends FormattingSettingsCard {
    autoRotate = new formattingSettings.ToggleSwitch({
        name: "autoRotate",
        displayNameKey: "Property_AutoRotate_DisplayName",
        displayName: "Auto-rotate scene",
        value: true
    });

    autoRotateSpeed = new formattingSettings.NumUpDown({
        name: "autoRotateSpeed",
        displayNameKey: "Property_AutoRotateSpeed_DisplayName",
        displayName: "Auto-rotate speed",
        value: 0.5
    });

    zoomSensitivity = new formattingSettings.NumUpDown({
        name: "zoomSensitivity",
        displayNameKey: "Property_ZoomSensitivity_DisplayName",
        displayName: "Zoom sensitivity",
        value: 1
    });

    orbitSensitivity = new formattingSettings.NumUpDown({
        name: "orbitSensitivity",
        displayNameKey: "Property_OrbitSensitivity_DisplayName",
        displayName: "Orbit sensitivity",
        value: 1
    });

    name = "camera";
    displayNameKey = "Object_Camera_DisplayName";
    displayName = "Camera";
    slices: Array<FormattingSettingsSlice> = [
        this.autoRotate,
        this.autoRotateSpeed,
        this.zoomSensitivity,
        this.orbitSensitivity
    ];
}

class PerformanceCardSettings extends FormattingSettingsCard {
    maxRenderedPoints = new formattingSettings.NumUpDown({
        name: "maxRenderedPoints",
        displayNameKey: "Property_MaxRenderedPoints_DisplayName",
        displayName: "Max rendered points",
        value: 10000
    });

    downsampleDenseScenes = new formattingSettings.ToggleSwitch({
        name: "downsampleDenseScenes",
        displayNameKey: "Property_DownsampleDenseScenes_DisplayName",
        displayName: "Downsample dense scenes",
        value: true
    });

    autoFetchMoreData = new formattingSettings.ToggleSwitch({
        name: "autoFetchMoreData",
        displayNameKey: "Property_AutoFetchMoreData_DisplayName",
        displayName: "Auto-fetch more data",
        value: false
    });

    aggregateSegments = new formattingSettings.ToggleSwitch({
        name: "aggregateSegments",
        displayNameKey: "Property_AggregateSegments_DisplayName",
        displayName: "Aggregate fetched segments",
        value: true
    });

    fetchTriggerPointCount = new formattingSettings.NumUpDown({
        name: "fetchTriggerPointCount",
        displayNameKey: "Property_FetchTriggerPointCount_DisplayName",
        displayName: "Fetch trigger row count",
        value: 9000
    });

    name = "performance";
    displayNameKey = "Object_Performance_DisplayName";
    displayName = "Performance";
    slices: Array<FormattingSettingsSlice> = [
        this.maxRenderedPoints,
        this.downsampleDenseScenes,
        this.autoFetchMoreData,
        this.aggregateSegments,
        this.fetchTriggerPointCount
    ];
}

class DiagnosticsCardSettings extends FormattingSettingsCard {
    showHostDiagnostics = new formattingSettings.ToggleSwitch({
        name: "showHostDiagnostics",
        displayNameKey: "Property_ShowHostDiagnostics_DisplayName",
        displayName: "Show host diagnostics",
        value: false
    });

    name = "diagnostics";
    displayNameKey = "Object_Diagnostics_DisplayName";
    displayName = "Diagnostics";
    slices: Array<FormattingSettingsSlice> = [this.showHostDiagnostics];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    sceneCard = new SceneCardSettings();
    displayCard = new DisplayCardSettings();
    textCard = new TextCardSettings();
    axesCard = new AxesCardSettings();
    legendCard = new LegendCardSettings();
    markersCard = new MarkersCardSettings();
    selectionCard = new SelectionCardSettings();
    cameraCard = new CameraCardSettings();
    performanceCard = new PerformanceCardSettings();
    diagnosticsCard = new DiagnosticsCardSettings();

    cards = [
        this.sceneCard,
        this.displayCard,
        this.textCard,
        this.axesCard,
        this.legendCard,
        this.markersCard,
        this.selectionCard,
        this.cameraCard,
        this.performanceCard,
        this.diagnosticsCard
    ];
}
