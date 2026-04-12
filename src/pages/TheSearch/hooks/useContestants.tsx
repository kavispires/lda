import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { deleteField } from 'firebase/firestore';
import { getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import type { Contestant } from '../types/contestant';
import { deserializeContestantCollection, serializeContestant } from '../utilities/serialization';

/**
 * Fetches all contestants from the-search/contestants document
 * Returns a record of Contestant objects keyed by ID
 */
export function useContestantsQuery() {
  return useQuery({
    queryKey: ['the-search', 'contestants'],
    queryFn: async () => {
      const data = await getDocQueryFunction<Record<string, string>>('the-search', 'contestants');
      return deserializeContestantCollection(data);
    },
  });
}

/**
 * Mutation to save or update a single contestant
 * Merges the contestant into the existing contestants document
 */
export function useSaveContestantMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<Contestant, Error, Contestant>({
    mutationFn: async (contestant) => {
      // Update the timestamp
      const contestantWithTimestamp = { ...contestant, updatedAt: Date.now() };
      const serialized = serializeContestant(contestantWithTimestamp);
      await updateDocQueryFunction('the-search', 'contestants', {
        [contestant.id]: serialized,
      });

      return contestantWithTimestamp;
    },
    onSuccess(contestant) {
      notification.success({
        title: 'Success',
        description: `Contestant "${contestant.name}" saved successfully`,
      });

      // Update the cache
      queryClient.invalidateQueries({
        queryKey: ['the-search', 'contestants'],
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

/**
 * Mutation to delete a contestant
 * Removes the contestant from the contestants document using Firebase deleteField()
 */
export function useDeleteContestantMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, string>({
    mutationFn: async (contestantId) => {
      await updateDocQueryFunction('the-search', 'contestants', {
        [contestantId]: deleteField(),
      });

      return true;
    },
    onSuccess() {
      notification.success({
        title: 'Success',
        description: 'Contestant deleted successfully',
      });

      queryClient.invalidateQueries({
        queryKey: ['the-search', 'contestants'],
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
