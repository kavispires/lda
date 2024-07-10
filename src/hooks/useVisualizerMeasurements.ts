import { useMemo } from 'react';
import { useMeasure, useWindowSize } from 'react-use';
import { UseMeasureRef } from 'react-use/lib/useMeasure';

function calculateAspectRatio(width: number, maxWidth: number, maxHeight: number) {
  const aspectRatio = 16 / 9;
  let calculatedWidth = width;
  let calculatedHeight = width / aspectRatio;

  if (calculatedWidth > maxWidth) {
    calculatedWidth = maxWidth;
    calculatedHeight = maxWidth / aspectRatio;
  }

  if (calculatedHeight > maxHeight) {
    calculatedHeight = maxHeight;
    calculatedWidth = maxHeight * aspectRatio;
  }

  return {
    width: calculatedWidth,
    height: calculatedHeight,
  };
}

type Area = {
  width: number;
  height: number;
};

export type UseVisualizerMeasurementsResult = {
  container: Area;
  stats: Area;
  distribution: Area;
};

export function useVisualizerMeasurements(
  fullScreenMode: boolean
): [UseMeasureRef<HTMLDivElement>, UseVisualizerMeasurementsResult] {
  const [containerRef, containerMeasures] = useMeasure<HTMLDivElement>();
  const windowSize = useWindowSize();

  const measurements = useMemo(() => {
    // Always keep the aspect ratio of 16:9
    const container = calculateAspectRatio(
      fullScreenMode ? windowSize.width : containerMeasures.width,
      windowSize.width,
      windowSize.height
    );

    const stats = {
      width: container.width / 3,
      height: container.height,
    };

    const distribution = {
      width: (container.width * 2) / 3,
      height: container.height,
    };

    return {
      container,
      stats,
      distribution,
    };
  }, [containerMeasures.width, fullScreenMode, windowSize.height, windowSize.width]);

  return [containerRef, measurements];
}
