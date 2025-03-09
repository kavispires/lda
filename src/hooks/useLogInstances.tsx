import { useMemo } from 'react';

import type { Song } from 'types';
import { distributor } from 'utils';

export function useLogPart(partId: string, song: Song) {
  return useMemo(() => {
    return distributor.getPartSummary(partId, song);
  }, [partId, song]);
}

export function useLogLine(lineId: string, song: Song) {
  return useMemo(() => {
    return distributor.getLineSummary(lineId, song);
  }, [lineId, song]);
}

export function useLogSection(sectionId: string, song: Song) {
  return useMemo(() => {
    return distributor.getSectionSummary(sectionId, song);
  }, [sectionId, song]);
}
