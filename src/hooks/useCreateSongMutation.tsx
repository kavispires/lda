import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { createDoc } from 'services/firebase';
import type { FirestoreSong, Song } from 'types';

import { useAddListingEntryMutation } from './useListingQuery';
import { serializeSong } from './useSong';

export function useCreateSongMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const updateListingMutation = useAddListingEntryMutation('songs');

  return useMutation<FirestoreSong, Error, Song>({
    mutationFn: async (data) => {
      // Create new song document in Firestore
      const dataWithId = await createDoc('songs', serializeSong(data));
      // Create new listing entry
      await updateListingMutation.mutateAsync({
        id: dataWithId.id,
        name: `${dataWithId.originalArtist} - ${dataWithId.title}`,
        type: 'song',
      });

      // Update query cache with new song to avoid refetching
      queryClient.setQueryData(['song', dataWithId.id], dataWithId);
      return dataWithId;
    },
    onSuccess() {
      notification.success({
        message: 'Success',
        description: 'Song created successfully',
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
