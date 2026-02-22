import { Select } from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
import type { useListingQuery } from 'hooks/useListingQuery';
import { useQueryParams } from 'hooks/useQueryParams';
import { useMemo } from 'react';

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

export const useListingSelect = (
  listingData: ReturnType<typeof useListingQuery>['data'],
  paramKey: string,
  allKey: string,
) => {
  const { queryParams } = useQueryParams();

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

  return {
    list,
    options,
    activeValue,
    activeList,
  };
};
