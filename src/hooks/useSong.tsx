import { deleteDocQueryFunction, getDocQueryFunction, updateDocQueryFunction } from '@services/firebase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FirestoreSong, Song, UID } from '@types';
import { distributor } from '@utils';
import { App } from 'antd';
import { deleteField } from 'firebase/firestore';
import { cloneDeep } from 'lodash';

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

  // Remove parts with empty text, or that are orphans (no line, or line doesn't claim them), detaching from their line
  Object.values(copy.content).forEach((entry) => {
    if (entry.type !== 'part') return;

    const parentLine = entry.lineId ? copy.content[entry.lineId] : undefined;
    const isOrphan = parentLine?.type !== 'line' || !parentLine.partsIds.includes(entry.id);

    if (!entry.text || isOrphan) {
      delete copy.content[entry.id];

      if (parentLine && parentLine.type === 'line') {
        parentLine.partsIds = parentLine.partsIds.filter((partId) => partId !== entry.id);
      }
    }
  });

  // Remove lines left without parts, or that are orphans (no section, or section doesn't claim them), detaching from their section
  // (run after the parts pass above so `partsIds` is already up to date)
  Object.values(copy.content).forEach((entry) => {
    if (entry.type !== 'line') return;

    const parentSection = entry.sectionId ? copy.content[entry.sectionId] : undefined;
    const isOrphan = parentSection?.type !== 'section' || !parentSection.linesIds.includes(entry.id);

    if (!entry.partsIds.length || isOrphan) {
      delete copy.content[entry.id];

      if (parentSection && parentSection.type === 'section') {
        parentSection.linesIds = parentSection.linesIds.filter((lineId) => lineId !== entry.id);
      }
    }
  });

  // Remove sections left without lines, or that are orphans (not listed in the song's sectionIds)
  // (run after the lines pass above so `linesIds` is already up to date)
  Object.values(copy.content).forEach((entry) => {
    if (entry.type === 'section' && (!entry.linesIds.length || !copy.sectionIds.includes(entry.id))) {
      delete copy.content[entry.id];
    }
  });

  // Keep the song's sectionIds in sync with the sections that actually remain
  copy.sectionIds = copy.sectionIds.filter((sectionId) => copy.content[sectionId]?.type === 'section');

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

      // Update listing with timestamp and any changes in the name
      try {
        await updateDocQueryFunction('listings', 'songs', {
          [`${data.id}.updatedAt`]: Date.now(),
          [`${data.id}.name`]: `${data.originalArtist} - ${data.title}`,
        });
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: on purpose
        console.error('Failed to update listing:', error);
        notification.error({
          title: 'Error',
          description: 'Failed to update listing with the latest changes. Song was saved.',
        });
      }

      return serializedSong;
    },
    onSuccess() {
      notification.success({
        title: 'Success',
        description: 'Song updated successfully',
      });
      queryClient.refetchQueries({
        queryKey: ['listings', 'songs'],
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
        title: 'Success',
        description: 'Song deleted successfully',
      });
      queryClient.refetchQueries({
        queryKey: ['listings', 'songs'],
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
