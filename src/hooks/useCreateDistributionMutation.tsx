import { App } from 'antd';
import { keyBy } from 'lodash';
import { createDoc } from 'services/firebase';
import type { Artist, Distribution, FirestoreDistribution, Group, Song } from 'types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAddListingEntryMutation } from './useListingQuery';

import { distributor } from 'utils';

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
        message: 'Success',
        description: 'Distribution created successfully',
      });
    },
    onError(error) {
      notification.error({
        message: 'Error',
        description: error.message,
      });
    },
  });
}

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
