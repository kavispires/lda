import { getDocQueryFunction, updateDocQueryFunction } from '@services/firebase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dictionary, ListingEntry, TypeaheadEntry } from '@types';
import { buildTypeahead } from '@utils';
import { App } from 'antd';
import { orderBy } from 'lodash';

/**
 * Minimum fields required to sort extracted listing data and build its typeahead.
 */
interface BaseData {
  id: string;
  name: string;
}

/**
 * The normalized result returned by {@link useListingQuery}.
 *
 * @typeParam TData - The type stored in each listing entry's optional `data` field.
 */
type ListingResult<TData = unknown> = {
  /** Entries keyed by Firebase document ID. */
  data: Dictionary<ListingEntry<TData>>;
  /** All entries sorted alphabetically by their display name. */
  list: ListingEntry<TData>[];
  /** Search options derived from the listing entries. */
  typeahead: TypeaheadEntry[];
};

/**
 * Fetches and normalizes a Firestore listing document.
 *
 * The query is cached under `['listings', listingType]`. Its result preserves
 * each {@link ListingEntry} wrapper and additionally provides a name-sorted list
 * and typeahead search options.
 *
 * @typeParam TData - The type stored in each listing entry's optional `data` field.
 * @param listingType - The Firestore document ID identifying the listing to fetch.
 * @returns A TanStack Query result containing the normalized listing data.
 */
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

/**
 * The normalized result returned by {@link useListingDataQuery}.
 *
 * @typeParam TData - The data type extracted from each listing entry.
 */
type ListingDataResult<TData> = {
  /** Defined entry data keyed by Firebase document ID. */
  data: Dictionary<TData>;
  /** Extracted entry data sorted alphabetically by name. */
  list: TData[];
  /** Search options derived from the extracted entry data. */
  typeahead: TypeaheadEntry[];
};

/**
 * Fetches a Firestore listing and extracts its defined `data` values.
 *
 * Unlike {@link useListingQuery}, this hook omits the {@link ListingEntry}
 * wrappers and entries without data. The result is cached under
 * `['listings', listingType]`.
 *
 * @typeParam TData - The entry-data type, which must contain an ID and a name.
 * @param listingType - The Firestore document ID identifying the listing to fetch.
 * @returns A TanStack Query result containing the extracted, normalized listing data.
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

/**
 * Creates a mutation that adds or replaces one entry in a Firestore listing.
 *
 * The mutation writes the entry at its `id` key in `listings/{listingType}`.
 * It displays an error notification if the write fails. Its metadata identifies
 * the affected query as `['listings', listingType]`; metadata needs a mutation
 * cache handler to cause automatic invalidation.
 *
 * @param listingType - The Firestore document ID of the listing to update.
 * @returns A TanStack Query mutation that accepts the listing entry to write.
 */
export function useAddListingEntryMutation(listingType: string) {
  const { notification } = App.useApp();

  return useMutation<unknown, Error, ListingEntry>({
    mutationFn: async (data) => {
      return await updateDocQueryFunction('listings', listingType, { [data.id]: data });
    },
    onError: (error) => {
      notification.error({
        title: 'Failed to update listing',
        description: error.message,
      });
    },
    meta: {
      invalidateQueries: ['listings', listingType],
    },
  });
}

/**
 * Creates a mutation that updates a nested path in any Firestore listing.
 *
 * On success, it invalidates active queries cached under
 * `['listings', listingType]`. Failures are shown through an Ant Design
 * notification.
 *
 * @returns A TanStack Query mutation that accepts the target listing type, path,
 * and replacement value.
 */
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
        title: 'Failed to update listing',
        description: error.message,
      });
    },
  });
}
