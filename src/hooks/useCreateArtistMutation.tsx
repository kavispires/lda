import { createDoc } from '@services/firebase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Artist, Dictionary, Group, ListingEntry } from '@types';
import { App } from 'antd';
import { merge } from 'lodash';

import { useAddListingEntryMutation, usePartialUpdateListingEntryMutation } from './useListingQuery';

type NewArtistMutationVariables = { artist: Artist; group: Group };

export function useCreateArtistMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const updateArtistsListingMutation = useAddListingEntryMutation('artists');
  const partialUpdateListingEntryMutation = usePartialUpdateListingEntryMutation();

  return useMutation<Artist, Error, NewArtistMutationVariables>({
    mutationFn: async ({ artist, group }) => {
      // Create new artist document in Firestore
      const dataWithId = await createDoc('artists', artist);

      // Create new listing entry
      await updateArtistsListingMutation.mutateAsync({
        id: dataWithId.id,
        name: `${dataWithId.name} (${group.name})`,
        type: 'artist',
        data: dataWithId,
      });

      const artistListingEntry: ListingEntry<Artist> = {
        id: dataWithId.id,
        name: `${dataWithId.name} (${group.name})`,
        type: 'artist',
        data: dataWithId,
      };

      queryClient.setQueryData<Dictionary<ListingEntry<Artist>>>(['listings', 'artists'], (previous) =>
        merge({}, previous, { [dataWithId.id]: artistListingEntry }),
      );

      // Update group
      const artistPosition = Object.keys(group.artistsIds).length;
      await partialUpdateListingEntryMutation.mutateAsync({
        listingType: 'groups',
        path: `${group.id}.data.artistsIds.${dataWithId.id}`,
        data: artistPosition,
      });

      queryClient.setQueryData<Dictionary<ListingEntry<Group>>>(['listings', 'groups'], (previous) =>
        merge({}, previous, {
          [group.id]: {
            data: {
              artistsIds: {
                [dataWithId.id]: artistPosition,
              },
            },
          },
        }),
      );

      return dataWithId;
    },
    onSuccess() {
      notification.success({
        title: 'Success',
        description: 'Artist created successfully',
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
