import { App } from 'antd';
import { ContentError, ContentLoading } from 'components/Content';
import { useDanceFormationQuery, useFormationMutation } from 'hooks/useDanceFormation';
import { assign, cloneDeep } from 'lodash';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStateWithHistory } from 'react-use';
import type { Dictionary, Distribution, Formation, FUID, Group, Song } from 'types';
import { distributor } from 'utils';
import { SEPARATOR } from 'utils/constants';
import { useSongDistributionContext } from './SongDistributionProvider';

export const STAGE_X_SIZE = 27;
export const STAGE_Y_SIZE = 19;

type DanceFormationType = {
  formation: Formation;
  timeline: Dictionary<string[]>;
  clipboard: string[] | null;
  updateDancerPosition: (timestamp: number, dancerId: FUID, x: number, y: number) => void;
  updateTimestamp: (oldTimestamp: number, newTimestamp: number) => void;
  deleteTimestamp: (timestamp: number) => void;
  addTimestamp: (timestamp: number) => void;
  copyToClipboard: (timestamp: number) => void;
  pasteEntry: (timestamp: number) => void;
  onSave: () => void;
  activeTimestamp: string;
  setActiveTimestamp: (timestamp: string) => void;
  previousTimestamp: string;
  onNextTimestamp: () => void;
  onPreviousTimestamp: () => void;
};

const DanceFormationContext = createContext<DanceFormationType | undefined>(undefined);

export const DanceFormationProvider = ({ children }: PropsWithChildren) => {
  const { message } = App.useApp();
  const { formationId } = useParams();
  const { song, group, distribution } = useSongDistributionContext();

  const formationQuery = useDanceFormationQuery(
    formationId ?? '',
    generateDraftFormation(distribution, song, group),
  );
  const mutation = useFormationMutation();
  const formation = formationQuery.data ?? generateDraftFormation(distribution, song, group);

  const [timeline, setTimeline] = useState<Dictionary<string[]>>(formation.timeline);
  const [clipboard, setClipboard] = useState<string[] | null>(null);

  const [activeTimestamp, setActiveTimestamp, timestampHistory] = useStateWithHistory<string, string>('0');
  console.log(timestampHistory);

  useEffect(() => {
    if (!formationQuery.isLoading && formationQuery.data) {
      setTimeline(formationQuery.data.timeline);
    }
  }, [formationQuery.isLoading, formationQuery.data]);

  if (formationQuery.isLoading || !distribution) {
    return <ContentLoading>Loading distribution...</ContentLoading>;
  }

  if (formationQuery.isError) {
    return <ContentError>{formationQuery.error.message}</ContentError>;
  }

  const previousTimestamp = String(
    Math.max(0, Number(timestampHistory.history[timestampHistory.history.length - 2] ?? 0)),
  );

  const onNextTimestamp = () => {
    const orderedTimestamps = Object.keys(timeline).sort((a, b) => Number(a) - Number(b));
    const nextTimestamp = orderedTimestamps[orderedTimestamps.indexOf(activeTimestamp) + 1];
    setActiveTimestamp(nextTimestamp ?? orderedTimestamps[orderedTimestamps.length - 1]);
  };

  const onPreviousTimestamp = () => {
    const orderedTimestamps = Object.keys(timeline).sort((a, b) => Number(a) - Number(b));
    const previousTimestamp = orderedTimestamps[orderedTimestamps.indexOf(activeTimestamp) - 1];
    setActiveTimestamp(previousTimestamp ?? '0');
  };

  const updateDancerPosition = (timestamp: number, dancerId: FUID, x: number, y: number) => {
    const dancerIndex = formation.assigneesIds.indexOf(dancerId);
    if (dancerIndex === -1) {
      throw new Error(`Dancer ${dancerId} not found in formation`);
    }

    const timelineEntry = cloneDeep(timeline[timestamp]);
    timelineEntry[dancerIndex] = `${x}${SEPARATOR}${y}`;
    setTimeline(assign({}, timeline, { [timestamp]: timelineEntry }));
  };

  const updateTimestamp = (oldTimestamp: number, newTimestamp: number) => {
    const copy = cloneDeep(timeline);
    const timelineEntry = copy[oldTimestamp];
    copy[newTimestamp] = timelineEntry;
    delete copy[oldTimestamp];
    setTimeline(copy);
  };

  const deleteTimestamp = (timestamp: number) => {
    const copy = cloneDeep(timeline);
    delete copy[timestamp];
    setTimeline(copy);
  };

  const addTimestamp = (timestamp: number) => {
    const copy = cloneDeep(timeline);
    // Find the closest timestamp to the new one
    const orderedTimestamps = Object.keys(timeline).sort((a, b) => Number(a) - Number(b));
    let closestTimestamp = '0';
    for (let i = 0; i < orderedTimestamps.length; i++) {
      if (Number(orderedTimestamps[i]) > timestamp) {
        break;
      }
      closestTimestamp = orderedTimestamps[i];
    }

    const closestTimestampValue = copy[closestTimestamp];
    copy[timestamp] = closestTimestampValue;
    setTimeline(copy);
  };

  const copyToClipboard = (timestamp: number) => {
    setClipboard(timeline[timestamp]);
    message.info('Copied to clipboard');
  };

  const pasteEntry = (timestamp: number) => {
    if (!clipboard) {
      return;
    }
    const copy = cloneDeep(timeline);
    copy[timestamp] = clipboard;
    setTimeline(copy);
    setClipboard(null);
  };

  const onSave = () => {
    mutation.mutate({
      ...formation,
      timeline,
    });
  };

  return (
    <DanceFormationContext.Provider
      value={{
        formation,
        timeline,
        clipboard,
        updateDancerPosition,
        updateTimestamp,
        deleteTimestamp,
        addTimestamp,
        copyToClipboard,
        pasteEntry,
        onSave,
        setActiveTimestamp,
        activeTimestamp: activeTimestamp ?? '0',
        previousTimestamp,
        onNextTimestamp,
        onPreviousTimestamp,
      }}
    >
      {children}
    </DanceFormationContext.Provider>
  );
};

export const useDanceFormationContext = () => {
  const context = useContext(DanceFormationContext);

  if (!context) {
    throw new Error('useDanceFormationContext must be used within a DanceFormationProvider');
  }

  return context;
};

const generateDraftFormation = (distribution: Distribution, song: Song, group: Group): Formation => {
  const assigneesIds = Object.keys(distribution.assignees);
  const centerY = Math.floor(STAGE_Y_SIZE / 2);
  const centerX = Math.floor(STAGE_X_SIZE / 2);

  const basicFormation = assigneesIds.map((_, index, all) => {
    const xPosition = centerX - Math.floor(all.length / 2) + index;
    return `${xPosition}${SEPARATOR}${centerY}`;
  });

  const timeline = {
    '0': cloneDeep(basicFormation),
    [song.startAt]: cloneDeep(basicFormation),
    ...song.sectionIds.reduce((acc: Record<string, any>, sectionId) => {
      const section = distributor.getSectionSummary(sectionId, song);
      if (section) {
        acc[section.startTime] = cloneDeep(basicFormation);
      }
      return acc;
    }, {}),
    [song.endAt]: cloneDeep(basicFormation),
  };

  return {
    id: '$draft',
    type: 'formation',
    distributionId: distribution.id,
    songId: song.id,
    groupId: group.id,
    assigneesIds: Object.keys(distribution.assignees),
    timeline,
    createdAt: Date.now(),
  };
};
