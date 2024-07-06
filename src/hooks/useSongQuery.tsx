import { useQuery } from '@tanstack/react-query';
import { getDocQueryFunction } from 'services/firebase';
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
  });
}
