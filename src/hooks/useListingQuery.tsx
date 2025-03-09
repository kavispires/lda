import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { orderBy } from 'lodash';
import { getDocQueryFunction, updateDocQueryFunction } from 'services/firebase';
import type { Dictionary, ListingEntry, TypeaheadEntry } from 'types';
import { buildTypeahead } from 'utils';

interface BaseData {
  id: string;
  name: string;
}

type ListingResult<TData = unknown> = {
  data: Dictionary<ListingEntry<TData>>;
  list: ListingEntry<TData>[];
  typeahead: TypeaheadEntry[];
};

export function useListingQuery<TData = unknown>(listingType: string) {
  return useQuery<Dictionary<ListingEntry<TData>>, Error, ListingResult<TData>>({
    queryKey: ['listings', listingType],
    queryFn: async () => {
      return await getDocQueryFunction<Dictionary<ListingEntry<TData>>>('listings', listingType);
    },
    placeholderData: {},
    select: (response) => {
      return {
        data: response,
        list: orderBy(Object.values(response), (obj) => obj.name.toLowerCase()),
        typeahead: buildTypeahead(response || {}),
      };
    },
  });
}

type ListingDataResult<TData> = {
  data: Dictionary<TData>;
  list: TData[];
  typeahead: TypeaheadEntry[];
};

/**
 * Custom hook for fetching listing data but returning the data in a more usable format.
 * Use case: artists and groups
 * @template TData - The type of data for each listing entry.
 * @param listingType - The type of listing.
 * @returns - The query result.
 */
export function useListingDataQuery<TData extends BaseData>(listingType: string) {
  return useQuery<Dictionary<ListingEntry<TData>>, Error, ListingDataResult<TData>>({
    queryKey: ['listings', listingType],
    queryFn: async () => {
      return await getDocQueryFunction<Dictionary<ListingEntry<TData>>>('listings', listingType);
    },
    placeholderData: {},
    select: (response) => {
      const data = Object.values(response).reduce((acc: Dictionary<TData>, entry) => {
        if (entry.data) {
          acc[entry.id] = entry.data;
        }
        return acc;
      }, {});

      return {
        data,
        list: orderBy(Object.values(data), (obj) => obj.name.toLowerCase()),
        typeahead: buildTypeahead(data || {}),
      };
    },
  });
}

export function useAddListingEntryMutation(listingType: string) {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, ListingEntry>({
    mutationFn: async (data) => {
      return await updateDocQueryFunction('listings', listingType, { [data.id]: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['listings', listingType],
        refetchType: 'active',
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

export function usePartialUpdateListingEntryMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { listingType: string; path: string; data: unknown }>({
    mutationFn: async ({ listingType, path, data }) => {
      return await updateDocQueryFunction('listings', listingType, { [path]: data });
    },
    onSuccess: (_, { listingType }) => {
      queryClient.invalidateQueries({
        queryKey: ['listings', listingType],
        refetchType: 'active',
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
