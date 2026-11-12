import { ContentError, ContentLoading } from '@components/Content';
import { generateDistributionName } from '@hooks/useCreateDistributionMutation';
import { useDistributionMutation, useDistributionQuery } from '@hooks/useDistribution';
import { useListingDataQuery } from '@hooks/useListingQuery';
import { useSongQuery } from '@hooks/useSong';
import { useVideoControls } from '@hooks/useVideoControls';
import type { Dictionary, Distribution, FUID, Group, Song, UID } from '@types';
import { distributor } from '@utils';
import { ALL_ID } from '@utils/constants';
import {
  addAssignmentBatch,
  buildDistributionSummary,
  type PartAssignmentUpdate,
  updatePartAssignments,
} from '@utils/distribution-assignments';
import { App } from 'antd';
import { isEmpty } from 'lodash';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

type SongDistributionType = {
  distribution: Distribution;
  song: Song;
  group: Group;
  videoControls: ReturnType<typeof useVideoControls>;
  mapping: Dictionary<FUID[]>;
  onAssign: (partId: UID, assignee: FUID) => void;
  onAssignMany: (partsIds: UID[], assignee: FUID) => void;
  onAssignBatch: (updates: PartAssignmentUpdate[]) => boolean;
  activeAssignee: FUID;
  onActivateAssignee: (assignee: FUID) => void;
  mappingProgress: number;
  onSave: () => void;
  isSaving: boolean;
};

const SongDistributionContext = createContext<SongDistributionType | undefined>(undefined);

type SongDistributionProviderProps = PropsWithChildren & {
  draftDistribution?: Distribution;
};

export const SongDistributionProvider = ({ children, draftDistribution }: SongDistributionProviderProps) => {
  const { message } = App.useApp();
  const { distributionId } = useParams();
  const distributionQuery = useDistributionQuery(distributionId ?? '', draftDistribution);
  const songQuery = useSongQuery(distributionQuery.data?.songId ?? '');
  const groupsQuery = useListingDataQuery<Group>('groups');
  const distributionMutation = useDistributionMutation();

  const distribution = distributionQuery.data;
  const song = songQuery.data;
  const groups = groupsQuery.data;

  const videoControls = useVideoControls({ startAt: song?.startAt ?? 0, endAt: song?.endAt || 1 });

  const [mapping, setMapping] = useState<Dictionary<FUID[]>>({});
  const mappingRef = useRef(mapping);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only the song.id is important to retrigger the effect
  useEffect(() => {
    // biome-ignore lint/suspicious/noConsole: on purpose for debugging
    console.log('Initializing mapping for distribution', distributionId);
    if (isEmpty(mapping) && song?.content && distribution?.mapping) {
      const allParts = distributor.getAllParts(song);
      const newMapping: Dictionary<FUID[]> = {};
      allParts.forEach((part) => {
        newMapping[part.id] = distribution.mapping[part.id] ?? [];
      });
      mappingRef.current = newMapping;
      setMapping(newMapping);
    }
  }, [song?.id, distribution?.mapping]);

  const [activeAssignee, setActiveAssignee] = useState<FUID>(ALL_ID);

  const mappingProgress = useMemo(() => {
    const allParts = song ? distributor.getAllParts(song) : Object.keys(mapping);
    const mappingsWithAtLeastOneAssignee = Object.values(mapping).filter((assignees) => assignees.length > 0);

    return Number(((mappingsWithAtLeastOneAssignee.length / allParts.length) * 100).toFixed(2));
  }, [mapping, song]);

  if (!distributionId) {
    return <ContentError>You haven't selected a distribution</ContentError>;
  }

  if (distributionQuery.isLoading || !distribution) {
    return <ContentLoading>Loading distribution...</ContentLoading>;
  }

  if (songQuery.isLoading || !song) {
    return <ContentLoading>Loading song...</ContentLoading>;
  }

  if (groupsQuery.isLoading || !groups) {
    return <ContentLoading>Loading group</ContentLoading>;
  }

  if (distributionQuery.isError) {
    return <ContentError>{distributionQuery.error.message}</ContentError>;
  }

  if (songQuery.isError) {
    return <ContentError>{songQuery.error.message}</ContentError>;
  }

  if (groupsQuery.isError) {
    return <ContentError>{groupsQuery.error.message}</ContentError>;
  }

  const group = groups.data[distribution.groupId];

  // Failsafe
  if (!group) {
    return <ContentLoading>Gathering data...</ContentLoading>;
  }

  const commitAssignments = (result: ReturnType<typeof updatePartAssignments>) => {
    if (!result.ok) {
      message.error(result.message);
      return false;
    }
    mappingRef.current = result.mapping;
    setMapping(result.mapping);
    return true;
  };

  const onAssign = (partId: UID, assignee: FUID) =>
    commitAssignments(updatePartAssignments(mappingRef.current, [partId], assignee, 'toggle'));

  const onAssignMany = (partsIds: UID[], assignee: FUID) =>
    commitAssignments(updatePartAssignments(mappingRef.current, partsIds, assignee, 'add'));

  const onAssignBatch = (updates: PartAssignmentUpdate[]) =>
    commitAssignments(addAssignmentBatch(mappingRef.current, updates));

  const onActivateAssignee = (assignee: FUID) => {
    setActiveAssignee((prev) => {
      if (prev === assignee && assignee !== ALL_ID) {
        return ALL_ID;
      }
      return assignee;
    });
  };

  const onSave = () => {
    const { summary, maxAssigneeDuration } = buildDistributionSummary(
      song,
      mappingRef.current,
      distribution.assignees,
    );
    // Re-derive the name on every save in case the song's original artist (or the group's
    // name) changed since the distribution was created/last saved.
    const name = generateDistributionName(group, song);
    distributionMutation.mutate({
      ...distribution,
      name,
      mapping: mappingRef.current,
      summary,
      maxAssigneeDuration,
    });
  };

  return (
    <SongDistributionContext.Provider
      value={{
        distribution,
        song,
        group,
        videoControls,
        mapping,
        onAssign,
        onAssignMany,
        onAssignBatch,
        activeAssignee,
        onActivateAssignee,
        mappingProgress,
        onSave,
        isSaving: distributionMutation.isPending,
      }}
    >
      {children}
    </SongDistributionContext.Provider>
  );
};

export const useSongDistributionContext = () => {
  const context = useContext(SongDistributionContext);

  if (!context) {
    throw new Error('useSongDistributionContext must be used within a SongDistributionProvider');
  }

  return context;
};
