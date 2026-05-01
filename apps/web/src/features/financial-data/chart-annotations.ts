const CHART_LABEL_MINIMUM_GAP = 6.4;
const CHART_LABEL_MINIMUM_TOP = 7;
const CHART_LABEL_MAXIMUM_TOP = 90;
const CHART_LAST_LABEL_PATH_ZONE_X = 86;

type ChartReferenceLabelKey = "last" | "previousClose";

export type ChartAnnotationLayout = {
  referenceLabelY: Partial<Record<ChartReferenceLabelKey, number>>;
  referenceLabelVisible: Record<ChartReferenceLabelKey, boolean>;
  axisLabelVisible: boolean[];
};

export type ChartTooltipPosition = {
  bottom?: string;
  left?: string;
  right?: string;
  top?: string;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function labelCollides(a: number, b: number, gap = CHART_LABEL_MINIMUM_GAP) {
  return Math.abs(a - b) < gap;
}

function lastLabelCollidesWithRightEdgePath(
  y: number,
  path: readonly { x: number; y: number }[] = [],
) {
  return path.some((point) => point.x >= CHART_LAST_LABEL_PATH_ZONE_X && labelCollides(y, point.y));
}

function labelPositionCandidates(anchorY: number, maxShift: number) {
  const candidates = [anchorY];
  for (let shift = CHART_LABEL_MINIMUM_GAP; shift <= maxShift; shift += CHART_LABEL_MINIMUM_GAP) {
    candidates.push(anchorY + shift, anchorY - shift);
  }

  return candidates
    .map((candidate) => clampPercent(candidate))
    .filter(
      (candidate) => candidate >= CHART_LABEL_MINIMUM_TOP && candidate <= CHART_LABEL_MAXIMUM_TOP,
    )
    .sort((a, b) => Math.abs(a - anchorY) - Math.abs(b - anchorY));
}

export function chartAnnotationLayout(referenceY: {
  last: number;
  previousClose?: number;
  axis: readonly { top: number }[];
  pricePath?: readonly { x: number; y: number }[];
}): ChartAnnotationLayout {
  const labels: Array<{
    key: ChartReferenceLabelKey;
    y: number;
    maxShift: number;
  }> = [
    { key: "last", y: referenceY.last, maxShift: 16 },
    ...(referenceY.previousClose === undefined
      ? []
      : [{ key: "previousClose" as const, y: referenceY.previousClose, maxShift: 10 }]),
  ];
  const placed: Array<{ key: ChartReferenceLabelKey; y: number }> = [];
  const referenceLabelY: Partial<Record<ChartReferenceLabelKey, number>> = {};
  const referenceLabelVisible: Record<ChartReferenceLabelKey, boolean> = {
    last: false,
    previousClose: false,
  };

  for (const label of labels) {
    if (label.key === "last" && lastLabelCollidesWithRightEdgePath(label.y, referenceY.pricePath)) {
      continue;
    }

    const labelY = labelPositionCandidates(label.y, label.maxShift).find((candidate) => {
      return placed.every((placedLabel) => !labelCollides(candidate, placedLabel.y));
    });

    if (labelY === undefined && label.key !== "last") continue;

    const resolvedY = labelY ?? clampPercent(label.y);
    placed.push({ key: label.key, y: resolvedY });
    referenceLabelY[label.key] = resolvedY;
    referenceLabelVisible[label.key] = true;
  }

  return {
    referenceLabelY,
    referenceLabelVisible,
    axisLabelVisible: referenceY.axis.map(() => true),
  };
}

export function chartTooltipPosition(point: { x: number; y: number }): ChartTooltipPosition {
  const horizontalGap = "1rem";
  const verticalGap = "1rem";

  return {
    ...(point.x > 50
      ? { right: `calc(${100 - clampPercent(point.x)}% + ${horizontalGap})` }
      : { left: `calc(${clampPercent(point.x)}% + ${horizontalGap})` }),
    ...(point.y > 50
      ? { bottom: `calc(${100 - clampPercent(point.y)}% + ${verticalGap})` }
      : { top: `calc(${clampPercent(point.y)}% + ${verticalGap})` }),
  };
}
