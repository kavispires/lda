import { App } from 'antd';
import { createDoc } from 'services/firebase';
import type { Artist, Group } from 'types';

import { useMutation } from '@tanstack/react-query';

import { usePartialUpdateListingEntryMutation, useAddListingEntryMutation } from './useListingQuery';

type NewArtistMutationVariables = { artist: Artist; group: Group };

export function useCreateArtistMutation() {
  const { notification } = App.useApp();
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

      // Update group
      await partialUpdateListingEntryMutation.mutateAsync({
        listingType: 'groups',
        path: `${group.id}.data.artistsIds.${dataWithId.id}`,
        data: Object.keys(group.artistsIds).length,
      });

      return dataWithId;
    },
    onSuccess() {
      notification.success({
        message: 'Success',
        description: 'Artist created successfully',
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
