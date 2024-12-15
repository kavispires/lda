import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { deleteField } from 'firebase/firestore';
import { cloneDeep, orderBy } from 'lodash';
import { deleteDocQueryFunction, getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import { FirestoreSong, Song, UID } from 'types';
import { distributor } from 'utils';

/**
 * Deserializes a FirestoreSong object into a Song object.
 * @param fbSong - The FirestoreSong object to deserialize.
 * @returns The deserialized Song object.
 */
const deserializeSong = (fbSong: FirestoreSong): Song => {
  return {
    ...fbSong,
    content: JSON.parse(fbSong.content),
  };
};

export function useSongQuery(songId: string) {
  return useQuery<FirestoreSong, Error, Song>({
    queryKey: ['song', songId],
    queryFn: async () => {
      return await getDocQueryFunction<FirestoreSong>('songs', songId);
    },
    select: (data) => {
      return deserializeSong(data);
    },
    enabled: !!songId,
  });
}

/**
 * Serializes a Song object into a FirestoreSong object.
 * @param song - The Song object to be serialized.
 * @returns The serialized FirestoreSong object.
 */
export const serializeSong = (song: Song): FirestoreSong => {
  const copy = cloneDeep(song);

  // Delete any dismissible and adlib properties from the song lines if false
  Object.values(copy.content).forEach((entry) => {
    if (entry.type === 'line') {
      if (entry.dismissible === false) {
        delete entry.dismissible;
      }
      if (entry.adlib === false) {
        delete entry.adlib;
      }
    }
  });

  copy.ready = distributor.isSongReady(copy);

  if (copy.ready) {
    // Sort parts in lines
    distributor.getAllLines(copy).forEach((line) => {
      line.partsIds = orderBy(
        line.partsIds,
        [(partId) => distributor.getPart(partId, copy).startTime],
        ['asc']
      );
    });
    // Song lines in sections
    distributor.getAllSections(copy).forEach((section) => {
      section.linesIds = orderBy(
        section.linesIds,
        [(lineId) => distributor.getLineStartTime(lineId, copy)],
        ['asc']
      );
    });
    // Sort section Ids
    copy.sectionIds = orderBy(
      copy.sectionIds,
      [(sectionId) => distributor.getSectionStartTime(sectionId, copy)],
      ['asc']
    );
  }

  return {
    ...copy,
    content: JSON.stringify(copy.content),
  };
};

export function useSongMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<FirestoreSong, Error, Song>({
    mutationFn: async (data) => {
      const serializedSong = serializeSong(data);
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

export function useDeleteSongMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, UID>({
    mutationFn: async (songId) => {
      // Update listing
      await updateDocQueryFunction('listings', 'songs', { [songId]: deleteField() });

      // Delete song itself
      await deleteDocQueryFunction('songs', songId);

      return true;
    },
    onSuccess() {
      notification.success({
        message: 'Success',
        description: 'Song deleted successfully',
      });
      queryClient.refetchQueries({
        queryKey: ['listings', 'songs'],
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
