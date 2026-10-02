import { createDoc } from '@services/firebase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Artist, Distribution, FirestoreDistribution, Group, Song } from '@types';
import { distributor } from '@utils';
import { App } from 'antd';
import { keyBy } from 'lodash';
import { useAddListingEntryMutation } from './useListingQuery';

type NewDistributionMutationVariables = { song: Song; group: Group; selectedArtists: Artist[] };

export function useCreateDistributionMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const updateListingMutation = useAddListingEntryMutation('distributions');

  return useMutation<FirestoreDistribution, Error, NewDistributionMutationVariables>({
    mutationFn: async ({ song, group, selectedArtists }) => {
      // Create new distribution document in Firestore
      const dataWithId = await createDoc('distributions', createDistribution(song, group, selectedArtists));
      // Create new listing entry
      await updateListingMutation.mutateAsync({
        id: dataWithId.id,
        name: `${group.name} - ${song.title}`,
        type: 'distribution',
      });

      // Update query cache with new song to avoid refetching
      queryClient.setQueryData(['distributions', dataWithId.id], dataWithId);
      return dataWithId;
    },
    onSuccess() {
      notification.success({
        title: 'Success',
        description: 'Distribution created successfully',
      });
    },
    onError(error) {
      notification.error({
        title: 'Error',
        description: error.message,
      });
    },
  });
}

/**
 * Generates the display name for a distribution, combining the group name and song title,
 * and appending the song's original artist in parenthesis when it differs from the group
 * performing it (e.g. a cover).
 */
export const generateDistributionName = (group: Group, song: Song): string => {
  let name = `${group.name} - ${song.title}`;
  if (group.name !== song.originalArtist) {
    name += ` (${song.originalArtist})`;
  }
  return name;
};

export const generateDraftDistribution = (
  song: Song,
  group: Group,
  selectedArtists: Artist[],
): Distribution => {
  const assignees = keyBy(selectedArtists, 'id');

  const mapping = distributor.getAllParts(song).reduce((acc: Distribution['mapping'], part) => {
    acc[part.id] = [];
    return acc;
  }, {});

  const name = generateDistributionName(group, song);

  return {
    id: '$draft',
    type: 'distribution',
    songId: song.id,
    groupId: group.id,
    assignees,
    mapping,
    name,
    maxAssigneeDuration: 0,
    createdAt: Date.now(),
  };
};

const createDistribution = (song: Song, group: Group, selectedArtists: Artist[]): FirestoreDistribution => {
  const assignees = keyBy(selectedArtists, 'id');

  const mapping = distributor.getAllParts(song).reduce((acc: Distribution['mapping'], part) => {
    acc[part.id] = [];
    return acc;
  }, {});

  return {
    id: '_',
    type: 'distribution',
    songId: song.id,
    groupId: group.id,
    assignees,
    mapping: JSON.stringify(mapping),
    maxAssigneeDuration: 0,
    createdAt: Date.now(),
  };
};
