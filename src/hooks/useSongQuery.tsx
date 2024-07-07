import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import { FirestoreSong, Song } from 'types';
import { distributor } from 'utils';

export function useSongQuery(songId: string) {
  return useQuery<FirestoreSong, Error, Song>({
    queryKey: ['song', songId],
    queryFn: async () => {
      return await getDocQueryFunction<FirestoreSong>('songs', songId);
    },
    select: (data) => {
      return distributor.deserializeSong(data);
    },
    enabled: !!songId,
  });
}

export function useSongMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<FirestoreSong, Error, Song>({
    mutationFn: async (data) => {
      const serializedSong = distributor.serializeSong(data);
      await updateDocQueryFunction('songs', data.id, serializedSong);

      queryClient.setQueryData(['song', data.id], serializedSong);

      return serializedSong;
    },
    onSuccess() {
      notification.success({
        message: 'Success',
        description: 'Song updated successfully',
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
