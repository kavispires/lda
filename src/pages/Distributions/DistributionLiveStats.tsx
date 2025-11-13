import { Divider, Flex } from 'antd';
import clsx from 'clsx';
import { ArtistBar } from 'components/Artist';
import { orderBy } from 'lodash';
import { useMemo } from 'react';
import { useSongDistributionContext } from 'services/SongDistributionProvider';
import type { Dictionary, Distribution, FUID, Song } from 'types';
import { distributor } from 'utils';
import { ALL_ID, NONE_ID } from 'utils/constants';

export function DistributionLiveStats() {
  const { song, mapping, activeAssignee, onActivateAssignee, distribution } = useSongDistributionContext();

  const assignees = useMemo(
    () => orderBy(Object.values(distribution.assignees), 'name'),
    [distribution.assignees],
  );

  const progress = useMemo(
    () => calculateLiveProgress(song, mapping, distribution.assignees),
    [song, mapping, distribution.assignees],
  );

  return (
    <div>
      <Flex gap={3} vertical wrap="wrap">
        <div
          className={clsx(
            'distribution-live-stats__button',
            activeAssignee === ALL_ID && 'distribution-live-stats__button--active',
          )}
          onClick={() => onActivateAssignee(ALL_ID)}
          role="button"
        >
          <ArtistBar
            artist={{
              id: ALL_ID,
              type: 'artist',
              name: ALL_ID,
              color: '#f1f1f1',
              track: 'VOCAL',
            }}
            className="distribution-live-stats__assignee"
            fixed
            fullProgress={progress[ALL_ID].percentage}
            progress={progress[ALL_ID].percentage}
            value={`${progress[ALL_ID].duration}s`}
          />
        </div>
        <div
          className={clsx(
            'distribution-live-stats__button',
            activeAssignee === NONE_ID && 'distribution-live-stats__button--active',
          )}
          onClick={() => onActivateAssignee(NONE_ID)}
          role="button"
        >
          <ArtistBar
            artist={{
              id: NONE_ID,
              type: 'artist',
              name: NONE_ID,
              color: '#f1f1f1',
              track: 'VOCAL',
            }}
            className="distribution-live-stats__assignee"
            fixed
            fullProgress={progress[NONE_ID].percentage}
            progress={progress[NONE_ID].percentage}
            value={`${progress[NONE_ID].duration}s`}
          />
        </div>
      </Flex>

      <Divider className="my-2" />

      <Flex gap={3} vertical wrap="wrap">
        {assignees.map((assignee) => (
          <div
            className={clsx(
              'distribution-live-stats__button',
              activeAssignee === assignee.id && 'distribution-live-stats__button--active',
            )}
            key={assignee.id}
            onClick={() => onActivateAssignee(assignee.id)}
            role="button"
          >
            <ArtistBar
              artist={assignee}
              className="distribution-live-stats__assignee"
              fixed
              fullProgress={progress[assignee.id].percentage}
              progress={progress[assignee.id].percentage}
              value={`${progress[assignee.id].duration}s`}
            />
          </div>
        ))}
      </Flex>
    </div>
  );
}

type AssigneeProgress = {
  duration: number;
  percentage: number;
};

const calculateLiveProgress = (
  song: Song,
  mapping: Distribution['mapping'],
  assignees: Distribution['assignees'],
): Record<FUID, AssigneeProgress> => {
  let totalDuration = 0;
  let progressForALL = 0;
  let progressForNONE = 0;
  const progressPerAssignee: Dictionary<number> = {};

  Object.keys(assignees).forEach((assignee) => {
    progressPerAssignee[assignee] = 0;
  });

  Object.entries(mapping).forEach(([partId, assignees]) => {
    const duration = distributor.getPartDuration(partId, song);
    totalDuration += duration;
    assignees.forEach((assignee) => {
      if (assignee === ALL_ID) {
        progressForALL += duration;
        return;
      }
      if (assignee === NONE_ID) {
        progressForNONE += duration;
        return;
      }
      progressPerAssignee[assignee] = (progressPerAssignee[assignee] || 0) + duration;
    });
  });

  const maxAssigneeDuration = Math.max(...Object.values(progressPerAssignee));

  return {
    [ALL_ID]: {
      duration: getSecondValue(progressForALL),
      percentage: (progressForALL / totalDuration) * 100,
    },
    [NONE_ID]: {
      duration: getSecondValue(progressForNONE),
      percentage: (progressForNONE / totalDuration) * 100,
    },
    ...Object.entries(progressPerAssignee).reduce(
      (acc: Record<FUID, AssigneeProgress>, [assignee, duration]) => {
        acc[assignee] = {
          duration: getSecondValue(duration),
          percentage: (duration / maxAssigneeDuration) * 100,
        };
        return acc;
      },
      {},
    ),
  };
};

const getSecondValue = (milliseconds: number) => Number((milliseconds / 1000).toFixed(1));
