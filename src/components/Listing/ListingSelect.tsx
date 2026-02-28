import { Input, Select } from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
import type { useListingQuery } from 'hooks/useListingQuery';
import { useQueryParams } from 'hooks/useQueryParams';
import { useMemo, useState } from 'react';

type ListingSelectProps = {
  options: DefaultOptionType[];
  paramKey: string;
  allKey: string;
  className?: string;
};

export function ListingSelect({ options, paramKey, allKey, className }: ListingSelectProps) {
  const { queryParams, addParam } = useQueryParams();

  return (
    <Select
      className={className ?? 'mb-2'}
      onChange={(value) => addParam(paramKey, value)}
      options={options}
      style={{ minWidth: 200 }}
      value={queryParams.get(paramKey) ?? allKey}
    />
  );
}

type ListingSearchProps = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  placeholder?: string;
  className?: string;
};

export function ListingSearch({ searchQuery, setSearchQuery, placeholder, className }: ListingSearchProps) {
  return (
    <Input.Search
      allowClear
      className={className ?? 'mb-2'}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder={placeholder ?? 'Search...'}
      style={{ width: 300 }}
      value={searchQuery}
    />
  );
}

export const useListingSelect = (
  listingData: ReturnType<typeof useListingQuery>['data'],
  paramKey: string,
  allKey: string,
) => {
  const { queryParams } = useQueryParams();
  const [searchQuery, setSearchQuery] = useState('');

  const list = useMemo(() => listingData?.list ?? [], [listingData]);

  const options = useMemo(() => {
    const optionsArr = list.reduce(
      (acc: string[], listingEntry) => {
        const [groupName] = listingEntry.name.split(' - ');
        if (!acc.includes(groupName)) {
          acc.push(groupName);
        }
        return acc;
      },
      [allKey],
    );
    return optionsArr.map((option) => ({ label: option, value: option }));
  }, [list, allKey]);

  const activeValue = queryParams.get(paramKey) ?? allKey;

  const activeList = useMemo(() => {
    if (activeValue === allKey) {
      return list;
    }

    return list.filter((listingEntry) => listingEntry.name.startsWith(activeValue));
  }, [list, activeValue, allKey]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) {
      return activeList;
    }
    const query = searchQuery.toLowerCase();
    return activeList.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [activeList, searchQuery]);

  return {
    list,
    options,
    activeValue,
    activeList,
    filteredList,
    searchQuery,
    setSearchQuery,
  };
};
