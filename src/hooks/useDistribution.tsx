import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { deleteField } from 'firebase/firestore';
import { deleteDocQueryFunction, getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import type { FirestoreDistribution, Distribution, UID } from 'types';

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

      return serializedDistribution;
    },
    onSuccess() {
      notification.success({
        message: 'Success',
        description: 'Distribution updated successfully',
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
        message: 'Success',
        description: 'Distribution deleted successfully',
      });
      queryClient.refetchQueries({
        queryKey: ['listings', 'distributions'],
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
