import { ContentError, ContentLoading } from 'components/Content';
import { useDistributionMutation, useDistributionQuery } from 'hooks/useDistribution';
import { useListingDataQuery } from 'hooks/useListingQuery';
import { useSongQuery } from 'hooks/useSong';
import { useVideoControls } from 'hooks/useVideoControls';
import { isEmpty } from 'lodash';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Dictionary, Distribution, FUID, Group, Song, UID } from 'types';
import { distributor, removeDuplicates } from 'utils';
import { ALL_ID, NONE_ID } from 'utils/constants';

type SongDistributionType = {
  distribution: Distribution;
  song: Song;
  group: Group;
  videoControls: ReturnType<typeof useVideoControls>;
  mapping: Dictionary<FUID[]>;
  onAssign: (partId: UID, assignee: FUID) => void;
  onAssignMany: (partsIds: UID[], assignee: FUID) => void;
  activeAssignee: FUID;
  onActivateAssignee: (assignee: FUID) => void;
  mappingProgress: number;
  onSave: () => void;
  isSaving: boolean;
};

const SongDistributionContext = createContext<SongDistributionType | undefined>(undefined);

export const SongDistributionProvider = ({ children }: PropsWithChildren) => {
  const { distributionId } = useParams();
  const distributionQuery = useDistributionQuery(distributionId ?? '');
  const songQuery = useSongQuery(distributionQuery.data?.songId ?? '');
  const groupsQuery = useListingDataQuery<Group>('groups');
  const distributionMutation = useDistributionMutation();

  const distribution = distributionQuery.data;
  const song = songQuery.data;
  const groups = groupsQuery.data;

  const videoControls = useVideoControls({ startAt: song?.startAt ?? 0, endAt: song?.endAt || 1 });

  const [mapping, setMapping] = useState<Dictionary<FUID[]>>({});

  useEffect(() => {
    console.log('RESETTING MAPPING');
    if (isEmpty(mapping) && song?.content && distribution?.mapping) {
      const allParts = distributor.getAllParts(song);
      const newMapping: Dictionary<FUID[]> = {};
      allParts.forEach((part) => {
        newMapping[part.id] = distribution.mapping[part.id] ?? [];
      });
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

  const onAssign = (partId: UID, assignee: FUID) => {
    setMapping((prev) => {
      const copy = { ...prev };
      const current = copy[partId] || [];
      if (current.includes(assignee)) {
        copy[partId] = current.filter((a) => a !== assignee);
      } else {
        copy[partId] = [...current, assignee];
      }
      return copy;
    });
  };

  const onAssignMany = (partsIds: UID[], assignee: FUID) => {
    setMapping((prev) => {
      const copy = { ...prev };
      partsIds.forEach((partId) => {
        copy[partId].push(assignee);
        copy[partId] = removeDuplicates(copy[partId]);
      });
      return copy;
    });
  };

  const onActivateAssignee = (assignee: FUID) => {
    setActiveAssignee((prev) => {
      if (prev === assignee && assignee !== ALL_ID) {
        return ALL_ID;
      }
      return assignee;
    });
  };

  const onSave = () => {
    const { summary, maxAssigneeDuration } = buildSummary(song, mapping, distribution.assignees);
    distributionMutation.mutate({
      ...distribution,
      mapping,
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

const buildSummary = (song: Song, mapping: Distribution['mapping'], assignees: Distribution['assignees']) => {
  const progressPerAssignee: Dictionary<number> = {};

  Object.keys(assignees).forEach((assignee) => {
    progressPerAssignee[assignee] = 0;
  });

  Object.entries(mapping).forEach(([partId, assignees]) => {
    const duration = distributor.getPartDuration(partId, song);

    assignees.forEach((assignee) => {
      if (assignee === ALL_ID || assignee === NONE_ID) {
        return;
      }

      progressPerAssignee[assignee] = (progressPerAssignee[assignee] || 0) + duration;
    });
  });

  const maxAssigneeDuration = Math.max(...Object.values(progressPerAssignee));

  return {
    maxAssigneeDuration,
    summary: progressPerAssignee,
  };
};
