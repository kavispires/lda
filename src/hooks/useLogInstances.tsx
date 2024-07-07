import { useMemo } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import { distributor } from 'utils';

export function useLogPart(partId: string) {
  const { song } = useSongEditContext();

  return useMemo(() => {
    return distributor.getPartSummary(partId, song);
  }, [partId, song]);
}

export function useLogLine(lineId: string) {
  const { song } = useSongEditContext();

  return useMemo(() => {
    return distributor.getLineSummary(lineId, song);
  }, [lineId, song]);
}

export function useLogSection(sectionId: string) {
  const { song } = useSongEditContext();

  return useMemo(() => {
    return distributor.getSectionSummary(sectionId, song);
  }, [sectionId, song]);
}
