import { useMutation } from '@tanstack/react-query';
import { App } from 'antd';
import { updateDocQueryFunction } from 'services/firebase';
import type { Artist } from 'types';

import { usePartialUpdateListingEntryMutation } from './useListingQuery';

type UpdateArtistMutationVariables = {
  artist: Artist;
  groupName: string;
};

export function useUpdateArtistMutation() {
  const { notification } = App.useApp();
  const partialUpdateListingEntryMutation = usePartialUpdateListingEntryMutation();

  return useMutation<Artist, Error, UpdateArtistMutationVariables>({
    mutationFn: async ({ artist, groupName }) => {
      // Update artist document in Firestore
      await updateDocQueryFunction('artists', artist.id, artist);

      // Update the entire listing entry
      await partialUpdateListingEntryMutation.mutateAsync({
        listingType: 'artists',
        path: artist.id,
        data: {
          id: artist.id,
          name: `${artist.name} (${groupName})`,
          type: 'artist',
          data: artist,
        },
      });

      //

      return artist;
    },
    onSuccess(_, variables) {
      notification.success({
        title: 'Success',
        description: `Artist "${variables.artist.name}" updated successfully`,
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
