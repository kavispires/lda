import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { deleteField } from 'firebase/firestore';
import { orderBy } from 'lodash';
import { deleteDocQueryFunction, getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import type { Distribution, FirestoreDistribution, UID } from 'types';
import { SEPARATOR } from 'utils/constants';

/**
 * Deserializes a FirestoreDistribution object into a Distribution object.
 * @param fbDistribution - The FirestoreDistribution object to deserialize.
 * @returns The deserialized Distribution object.
 */
const deserializeDistribution = (fbDistribution: FirestoreDistribution): Distribution => {
  return {
    ...fbDistribution,
    mapping: JSON.parse(fbDistribution.mapping),
  };
};

export function useDistributionQuery(distributionId: string) {
  return useQuery<FirestoreDistribution, Error, Distribution>({
    queryKey: ['distribution', distributionId],
    queryFn: async () => {
      return await getDocQueryFunction<FirestoreDistribution>('distributions', distributionId);
    },
    select: (data) => {
      return deserializeDistribution(data);
    },
    enabled: !!distributionId,
  });
}

/**
 * Serializes a Distribution object into a FirestoreDistribution object.
 * @param distribution - The Distribution object to be serialized.
 * @returns The serialized FirestoreDistribution object.
 */
const serializeDistribution = (distribution: Distribution): FirestoreDistribution => {
  return {
    ...distribution,
    mapping: JSON.stringify(distribution.mapping),
  };
};

export function useDistributionMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<FirestoreDistribution, Error, Distribution>({
    mutationFn: async (data) => {
      const serializedDistribution = serializeDistribution(data);
      await updateDocQueryFunction('distributions', data.id, serializedDistribution);

      queryClient.setQueryData(['distribution', data.id], serializedDistribution);

      // Update listing with timestamp and any changes in the name
      try {
        await updateDocQueryFunction('listings', 'distributions', {
          [`${data.id}.updatedAt`]: Date.now(),
          [`${data.id}.data`]: {
            snippet: buildDistributionListingSnippet(data),
          },
        });
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: on purpose
        console.error('Failed to update listing:', error);
        notification.error({
          title: 'Error',
          description: 'Failed to update listing with the latest changes. The distribution was saved.',
        });
      }

      return serializedDistribution;
    },
    onSuccess() {
      notification.success({
        title: 'Success',
        description: 'Distribution updated successfully',
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

export function useDeleteDistributionMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, UID>({
    mutationFn: async (distributionId) => {
      // Delete distribution itself
      await deleteDocQueryFunction('distributions', distributionId);

      // Update listing
      await updateDocQueryFunction('listings', 'distributions', { [distributionId]: deleteField() });

      return true;
    },
    onSuccess() {
      notification.success({
        title: 'Success',
        description: 'Distribution deleted successfully',
      });
      queryClient.refetchQueries({
        queryKey: ['listings', 'distributions'],
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

function buildDistributionListingSnippet(distribution: Distribution) {
  const assignees = distribution.assignees ?? {};
  const summary = distribution.summary ?? {};
  const total = Object.values(summary).reduce((sum, val) => sum + val, 0);
  // Gather the values of .summary and calculate the vocal percentage for each member
  const percentages = Object.entries(summary).reduce((acc: Record<string, number>, [memberId, duration]) => {
    const percentage = Number(total > 0 ? ((duration / total) * 100).toFixed(1) : '0.0');
    acc[memberId] = percentage;
    return acc;
  }, {});

  return orderBy(Object.keys(percentages), (memberId) => assignees[memberId]?.name, 'asc')
    .map((memberId) => [assignees[memberId].color, percentages[memberId], assignees[memberId].name].join('|'))
    .join(SEPARATOR);
}
