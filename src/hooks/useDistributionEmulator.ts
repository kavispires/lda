import { useMemo } from 'react';
import { Artist, Dictionary, Distribution, Song } from 'types';
import { distributor } from 'utils';

const SIMULATED_ASSIGNEES: Dictionary<Artist> = {
  A: {
    id: 'A',
    name: 'VOCALIST A',
    color: '#fec891',
    type: 'artist',
    track: 'VOCAL',
  },
  B: {
    id: 'B',
    name: 'VOCALIST B',
    color: '#ffef99',
    type: 'artist',
    track: 'VOCAL',
  },
  C: {
    id: 'C',
    name: 'RAPPER A',
    color: '#c3f0c7',
    type: 'artist',
    track: 'RAP',
  },
  D: {
    id: 'D',
    name: 'RAPPER B',
    color: '#b6e4e2',
    type: 'artist',
    track: 'RAP',
  },
  E: {
    id: 'E',
    name: 'AD-LIB A',
    color: '#a5c2fe',
    type: 'artist',
    track: 'VOCAL',
  },
  F: {
    id: 'F',
    name: 'AD-LIB B',
    color: '#e19e9e',
    type: 'artist',
    track: 'VOCAL',
  },
  G: {
    id: 'G',
    name: 'ALL',
    color: '#f1f1f1',
    type: 'artist',
    track: 'VOCAL',
  },
  H: {
    id: 'H',
    name: 'NONE',
    color: '#f1f1f1',
    type: 'artist',
    track: 'VOCAL',
  },
  I: {
    id: 'I',
    name: 'CENTER',
    color: '#fee6fb',
    type: 'artist',
    track: 'VOCAL',
  },
  X: {
    id: 'X',
    name: 'UNASSIGNED',
    color: '#CCFF0B',
    type: 'artist',
    track: 'VOCAL',
  },
};

export function useDistributionEmulator(song: Song): Distribution {
  return useMemo(() => {
    const parts = distributor.getAllParts(song);

    const totals: Dictionary<number> = {};

    const mapping = parts.reduce((acc: Distribution['mapping'], part) => {
      let assignee = part.recommendedAssignee;

      acc[part.id] = [assignee];
      totals[assignee] = (totals[assignee] || 0) + (part.endTime - part.startTime);

      return acc;
    }, {});

    const maxAssigneeDuration = Math.max(...Object.values(totals));

    return {
      id: 'simulated-distribution',
      type: 'distribution',
      songId: song.id,
      groupId: 'simulated-group',
      assignees: SIMULATED_ASSIGNEES,
      mapping,
      name: 'Simulated Distribution',
      createdAt: Date.now(),
      maxAssigneeDuration,
    };
  }, [song]);
}
