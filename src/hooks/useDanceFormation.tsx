import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createDocWithId, getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import { FirestoreFormation, Formation } from 'types';

/**
 * Deserializes a FirestoreFormation object into a Formation object.
 * @param fbFormation - The FirestoreFormation object to deserialize.
 * @returns The deserialized Formation object.
 */
const deserializeFormation = (fbFormation: FirestoreFormation): Formation => {
  return {
    ...fbFormation,
    timeline: JSON.parse(fbFormation.timeline),
  };
};

export function useDanceFormationQuery(formationId: string, draftData: Formation) {
  return useQuery<FirestoreFormation, Error, Formation>({
    queryKey: ['formation', formationId],
    queryFn: async () => {
      if (formationId === '$draft' && draftData) {
        return serializeFormation(draftData);
      }

      return await getDocQueryFunction<FirestoreFormation>('formations', formationId);
    },
    select: (data) => {
      return deserializeFormation(data);
    },
    enabled: !!formationId,
  });
}

/**
 * Serializes a Formation object into a FirestoreFormation object.
 * @param formation - The Formation object to be serialized.
 * @returns The serialized FirestoreFormation object.
 */
const serializeFormation = (formation: Formation): FirestoreFormation => {
  return {
    ...formation,
    timeline: JSON.stringify(formation.timeline),
  };
};

export function useFormationMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<FirestoreFormation, Error, Formation>({
    mutationFn: async (data) => {
      if (data.id === '$draft') {
        const serializedFormation = serializeFormation(data);
        serializedFormation.id = data.distributionId;
        const dataWithId = await createDocWithId(
          'formations',
          serializedFormation.id,
          serializeFormation(data)
        );
        queryClient.setQueryData(['formations', serializedFormation.id], serializedFormation);
        return dataWithId;
      }

      const serializedFormation = serializeFormation(data);
      await updateDocQueryFunction('formations', data.distributionId, serializedFormation);

      queryClient.setQueryData(['formations', data.id], serializedFormation);

      return serializedFormation;
    },
    onSuccess(data) {
      notification.success({
        message: 'Success',
        description: 'Formation updated successfully',
      });
      navigate(`/distributions/${data.distributionId}/formation/${data.id}`);
    },
    onError(error) {
      notification.error({
        message: 'Error',
        description: error.message,
      });
    },
  });
}
