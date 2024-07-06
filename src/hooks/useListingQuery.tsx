import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { orderBy } from 'lodash';
import { getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import { Dictionary, ListingEntry } from 'types';

export function useListingQuery(listingType: string) {
  return useQuery<Dictionary<ListingEntry>, Error, ListingEntry[]>({
    queryKey: ['listings', listingType],
    queryFn: async () => {
      return await getDocQueryFunction<Dictionary<ListingEntry>>('listings', listingType);
    },
    select: (data) => {
      return orderBy(Object.values(data), (obj) => obj.name.toLowerCase());
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
