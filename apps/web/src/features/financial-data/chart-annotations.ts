const CHART_LABEL_MINIMUM_GAP = 5.2;
const CHART_LABEL_MINIMUM_TOP = 7;
const CHART_LABEL_MAXIMUM_TOP = 90;

type ChartReferenceLabelKey = "last" | "previousClose" | "open";

export type ChartAnnotationLayout = {
  referenceLabelY: Partial<Record<ChartReferenceLabelKey, number>>;
  referenceLabelVisible: Record<ChartReferenceLabelKey, boolean>;
  axisLabelVisible: boolean[];
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function labelCollides(a: number, b: number, gap = CHART_LABEL_MINIMUM_GAP) {
  return Math.abs(a - b) < gap;
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
    .toSorted((a, b) => Math.abs(a - anchorY) - Math.abs(b - anchorY));
}

export function chartAnnotationLayout(referenceY: {
  last: number;
  previousClose?: number;
  open?: number;
  axis: readonly { top: number }[];
}): ChartAnnotationLayout {
  const labels: Array<{
    key: ChartReferenceLabelKey;
    y: number;
    maxShift: number;
    requiredGap?: number;
  }> = [
    { key: "last", y: referenceY.last, maxShift: 16 },
    ...(referenceY.previousClose === undefined
      ? []
      : [{ key: "previousClose" as const, y: referenceY.previousClose, maxShift: 10 }]),
    ...(referenceY.open === undefined
      ? []
      : [
          {
            key: "open" as const,
            y: referenceY.open,
            maxShift: 7,
            requiredGap: CHART_LABEL_MINIMUM_GAP,
          },
        ]),
  ];
  const placed: Array<{ key: ChartReferenceLabelKey; y: number }> = [];
  const referenceLabelY: Partial<Record<ChartReferenceLabelKey, number>> = {};
  const referenceLabelVisible: Record<ChartReferenceLabelKey, boolean> = {
    last: false,
    previousClose: false,
    open: false,
  };

  for (const label of labels) {
    if (
      label.requiredGap !== undefined &&
      placed.some((placedLabel) => labelCollides(label.y, placedLabel.y, label.requiredGap))
    ) {
      continue;
    }

    const labelY = labelPositionCandidates(label.y, label.maxShift).find((candidate) =>
      placed.every((placedLabel) => !labelCollides(candidate, placedLabel.y)),
    );

    if (labelY === undefined && label.key !== "last") continue;

    const resolvedY = labelY ?? clampPercent(label.y);
    placed.push({ key: label.key, y: resolvedY });
    referenceLabelY[label.key] = resolvedY;
    referenceLabelVisible[label.key] = true;
  }

  return {
    referenceLabelY,
    referenceLabelVisible,
    axisLabelVisible: referenceY.axis.map((axisLabel) =>
      placed.every((label) => !labelCollides(axisLabel.top, label.y, CHART_LABEL_MINIMUM_GAP + 1)),
    ),
  };
}
