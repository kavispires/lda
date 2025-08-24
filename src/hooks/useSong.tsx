import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { deleteField } from 'firebase/firestore';
import { cloneDeep } from 'lodash';
import { deleteDocQueryFunction, getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import type { FirestoreSong, Song, UID } from 'types';
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
        // TODO: Verify if it won't cagar everything
        entry.dismissible = undefined;
      }
      if (entry.adlib === false) {
        // TODO: Verify if it won't cagar everything
        entry.adlib = undefined;
      }
    }
  });

  // Delete any empty entity (parts without lineId, lines without sectionId, sectionIds, without lineIds)
  Object.values(copy.content).forEach((entry) => {
    if (entry.type === 'part' && !entry.lineId) {
      delete copy.content[entry.id];
    }
    if (entry.type === 'line' && !entry.sectionId) {
      delete copy.content[entry.id];
    }
    if (entry.type === 'section' && !entry.linesIds.length) {
      delete copy.content[entry.id];
    }
  });

  copy.ready = distributor.isSongReady(copy);

  if (copy.ready) {
    // Sort song
    distributor.sortSong(copy, true);

    // Romanize Sections
    distributor.determineSectionsNumbering(copy, true);
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
      // Delete song itself
      await deleteDocQueryFunction('songs', songId);

      // Update listing
      await updateDocQueryFunction('listings', 'songs', { [songId]: deleteField() });

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
