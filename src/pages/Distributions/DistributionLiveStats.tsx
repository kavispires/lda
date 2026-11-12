import { useSongDistributionContext } from '@services/SongDistributionProvider';
import type { Dictionary, Distribution, FUID, Song } from '@types';
import { distributor } from '@utils';
import { ALL_ID, NONE_ID } from '@utils/constants';
import { isRecordedAssignment } from '@utils/distribution-assignments';
import { Divider, Flex, Switch, Tooltip } from 'antd';
import clsx from 'clsx';
import { orderBy } from 'lodash';
import { useMemo, useState } from 'react';
import { DistributionStatsBar } from './DistributionStatsBar';

export function DistributionLiveStats() {
  const { song, mapping, activeAssignee, onActivateAssignee, distribution } = useSongDistributionContext();
  const [isBlindDistribution, setIsBlindDistribution] = useState(true);

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
      <Flex className="mb-2">
        <Tooltip title="Toggle to hide the values of the distribution bars for an unbiased distribution">
          <span>
            <Switch checked={isBlindDistribution} onChange={setIsBlindDistribution} size="small" /> Blind
            Distribution
          </span>
        </Tooltip>
      </Flex>

      <Flex gap={3} vertical wrap="wrap">
        {assignees.map((assignee) => (
          <div
            className={clsx(
              'distribution-live-stats__button',
              activeAssignee === assignee.id && 'distribution-live-stats__button--active',
            )}
            key={assignee.id}
          >
            <DistributionStatsBar
              adlibDuration={progress[assignee.id].adlibDuration}
              adlibPercentage={progress[assignee.id].adlibPercentage}
              adlibSongPercentage={progress[assignee.id].adlibSongPercentage}
              artist={assignee}
              className="distribution-live-stats__assignee"
              isBlindDistribution={isBlindDistribution}
              onClick={() => onActivateAssignee(assignee.id)}
              regularDuration={progress[assignee.id].regularDuration}
              regularPercentage={progress[assignee.id].regularPercentage}
              regularSongPercentage={progress[assignee.id].regularSongPercentage}
              totalDuration={progress[assignee.id].duration}
              totalPercentage={progress[assignee.id].percentage}
              totalSongPercentage={progress[assignee.id].totalSongPercentage}
            />
          </div>
        ))}
      </Flex>
      <Flex gap={3} vertical wrap="wrap">
        <Divider className="my-2" />
        <div
          className={clsx(
            'distribution-live-stats__button',
            activeAssignee === ALL_ID && 'distribution-live-stats__button--active',
          )}
        >
          <DistributionStatsBar
            adlibDuration={progress[ALL_ID].adlibDuration}
            adlibPercentage={progress[ALL_ID].adlibPercentage}
            adlibSongPercentage={progress[ALL_ID].adlibSongPercentage}
            artist={{
              id: ALL_ID,
              type: 'artist',
              name: ALL_ID,
              color: '#f1f1f1',
              track: 'VOCAL',
            }}
            className="distribution-live-stats__assignee"
            isBlindDistribution={isBlindDistribution}
            onClick={() => onActivateAssignee(ALL_ID)}
            regularDuration={progress[ALL_ID].regularDuration}
            regularPercentage={progress[ALL_ID].regularPercentage}
            regularSongPercentage={progress[ALL_ID].regularSongPercentage}
            totalDuration={progress[ALL_ID].duration}
            totalPercentage={progress[ALL_ID].percentage}
            totalSongPercentage={progress[ALL_ID].totalSongPercentage}
          />
        </div>
        <div
          className={clsx(
            'distribution-live-stats__button',
            activeAssignee === NONE_ID && 'distribution-live-stats__button--active',
          )}
        >
          <DistributionStatsBar
            adlibDuration={progress[NONE_ID].adlibDuration}
            adlibPercentage={progress[NONE_ID].adlibPercentage}
            adlibSongPercentage={progress[NONE_ID].adlibSongPercentage}
            artist={{
              id: NONE_ID,
              type: 'artist',
              name: NONE_ID,
              color: '#f1f1f1',
              track: 'VOCAL',
            }}
            className="distribution-live-stats__assignee"
            isBlindDistribution={isBlindDistribution}
            onClick={() => onActivateAssignee(NONE_ID)}
            regularDuration={progress[NONE_ID].regularDuration}
            regularPercentage={progress[NONE_ID].regularPercentage}
            regularSongPercentage={progress[NONE_ID].regularSongPercentage}
            totalDuration={progress[NONE_ID].duration}
            totalPercentage={progress[NONE_ID].percentage}
            totalSongPercentage={progress[NONE_ID].totalSongPercentage}
          />
        </div>
      </Flex>
    </div>
  );
}

type AssigneeProgress = {
  duration: number;
  percentage: number;
  regularPercentage: number;
  regularDuration: number;
  adlibDuration: number;
  adlibPercentage: number;
  totalSongPercentage: number;
  regularSongPercentage: number;
  adlibSongPercentage: number;
};

export const calculateLiveProgress = (
  song: Song,
  mapping: Distribution['mapping'],
  assignees: Distribution['assignees'],
): Record<FUID, AssigneeProgress> => {
  let totalDuration = 0;
  let progressForALL = 0;
  let progressForNONE = 0;
  let regularProgressForALL = 0;
  let regularProgressForNONE = 0;
  let adlibProgressForALL = 0;
  let adlibProgressForNONE = 0;
  const progressPerAssignee: Dictionary<number> = {};
  const regularProgressPerAssignee: Dictionary<number> = {};
  const adlibProgressPerAssignee: Dictionary<number> = {};

  Object.keys(assignees).forEach((assignee) => {
    progressPerAssignee[assignee] = 0;
    regularProgressPerAssignee[assignee] = 0;
    adlibProgressPerAssignee[assignee] = 0;
  });

  Object.entries(mapping).forEach(([partId, assignees]) => {
    if (isRecordedAssignment(assignees)) return;
    const duration = distributor.getPartDuration(partId, song);
    const part = distributor.getPart(partId, song);
    const line = distributor.getLine(part.lineId, song);
    const isAdlib = line.adlib;

    totalDuration += duration;

    assignees.forEach((assignee) => {
      if (assignee === ALL_ID) {
        progressForALL += duration;
        if (isAdlib) {
          adlibProgressForALL += duration;
        } else {
          regularProgressForALL += duration;
        }
        return;
      }
      if (assignee === NONE_ID) {
        progressForNONE += duration;
        if (isAdlib) {
          adlibProgressForNONE += duration;
        } else {
          regularProgressForNONE += duration;
        }
        return;
      }
      progressPerAssignee[assignee] = (progressPerAssignee[assignee] || 0) + duration;
      if (isAdlib) {
        adlibProgressPerAssignee[assignee] = (adlibProgressPerAssignee[assignee] || 0) + duration;
      } else {
        regularProgressPerAssignee[assignee] = (regularProgressPerAssignee[assignee] || 0) + duration;
      }
    });
  });

  const maxAssigneeDuration = Math.max(0, ...Object.values(progressPerAssignee));
  const percentage = (duration: number, total: number) => (total > 0 ? (duration / total) * 100 : 0);

  return {
    [ALL_ID]: {
      duration: getSecondValue(progressForALL),
      percentage: percentage(progressForALL, totalDuration),
      regularPercentage: percentage(regularProgressForALL, totalDuration),
      regularDuration: getSecondValue(regularProgressForALL),
      adlibDuration: getSecondValue(adlibProgressForALL),
      adlibPercentage: percentage(adlibProgressForALL, totalDuration),
      totalSongPercentage: percentage(progressForALL, totalDuration),
      regularSongPercentage: percentage(regularProgressForALL, totalDuration),
      adlibSongPercentage: percentage(adlibProgressForALL, totalDuration),
    },
    [NONE_ID]: {
      duration: getSecondValue(progressForNONE),
      percentage: percentage(progressForNONE, totalDuration),
      regularPercentage: percentage(regularProgressForNONE, totalDuration),
      regularDuration: getSecondValue(regularProgressForNONE),
      adlibDuration: getSecondValue(adlibProgressForNONE),
      adlibPercentage: percentage(adlibProgressForNONE, totalDuration),
      totalSongPercentage: percentage(progressForNONE, totalDuration),
      regularSongPercentage: percentage(regularProgressForNONE, totalDuration),
      adlibSongPercentage: percentage(adlibProgressForNONE, totalDuration),
    },
    ...Object.entries(progressPerAssignee).reduce(
      (acc: Record<FUID, AssigneeProgress>, [assignee, duration]) => {
        acc[assignee] = {
          duration: getSecondValue(duration),
          percentage: percentage(duration, maxAssigneeDuration),
          regularPercentage: percentage(regularProgressPerAssignee[assignee], maxAssigneeDuration),
          regularDuration: getSecondValue(regularProgressPerAssignee[assignee]),
          adlibDuration: getSecondValue(adlibProgressPerAssignee[assignee] || 0),
          adlibPercentage: percentage(adlibProgressPerAssignee[assignee] || 0, maxAssigneeDuration),
          totalSongPercentage: percentage(duration, totalDuration),
          regularSongPercentage: percentage(regularProgressPerAssignee[assignee], totalDuration),
          adlibSongPercentage: percentage(adlibProgressPerAssignee[assignee] || 0, totalDuration),
        };
        return acc;
      },
      {},
    ),
  };
};

const getSecondValue = (milliseconds: number) => Number((milliseconds / 1000).toFixed(1));
