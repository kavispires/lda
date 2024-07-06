import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { createDoc } from 'services/firebase';
import { FirestoreSong, Song } from 'types';
import { distributor } from 'utils';
import { useListingMutation } from './useListingQuery';
import { useNavigate } from 'react-router-dom';

export function useCreateSongMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const updateListingMutation = useListingMutation('songs');
  const navigate = useNavigate();

  return useMutation<FirestoreSong, Error, Song>({
    // This function will be called when the mutation is triggered
    mutationFn: async (data) => {
      // Create new song document in Firestore
      const dataWithId = await createDoc('songs', distributor.serializeSong(data));
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
    onSuccess(response) {
      notification.success({
        message: 'Success',
        description: 'Song created successfully',
      });
      navigate(`/song/${response.id}/edit`);
    },
    onError(error) {
      notification.error({
        message: 'Error',
        description: error.message,
      });
    },
  });
}
