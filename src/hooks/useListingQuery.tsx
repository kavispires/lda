import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import { Dictionary, ListingEntry } from 'types';

export function useListingQuery(listingType: string) {
  return useQuery<Dictionary<ListingEntry>, Error>({
    queryKey: ['listing', listingType],
    queryFn: async () => {
      return await getDocQueryFunction<Dictionary<ListingEntry>>('listing', listingType);
    },
  });
}

export function useListingMutation(listingType: string) {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ListingEntry>({
    mutationFn: async (data) => {
      return await updateDocQueryFunction('listings', listingType, { [data.id]: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['listing', listingType],
        refetchType: 'none',
      });
    },
    onError: (error) => {
      notification.error({
        message: 'Failed to update listing',
        description: error.message,
      });
    },
  });
}
