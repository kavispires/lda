import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useQueryParams(defaultParams: Record<string, string | number> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const addParam = (key: string, value: unknown, defaultValue?: unknown) => {
    if (value === undefined || value === '' || value === defaultValue) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, String(value));
    }

    setSearchParams(searchParams);
  };

  const addParams = (params: Record<string, unknown>, defaultValues: Record<string, unknown> = {}) => {
    Object.entries(params).forEach(([key, value]) => {
      if (defaultValues[key] === value) {
        searchParams.delete(key);
      } else {
        searchParams.set(key, String(value));
      }
    });
    setSearchParams(searchParams);
  };

  const removeParam = (key: string) => {
    searchParams.delete(key);
    setSearchParams(searchParams);
  };

  const is = (key: string, value = 'true') => searchParams.get(key) === String(value);

  useEffect(() => {
    Object.entries(defaultParams).forEach(([key, value]) => {
      if (!searchParams.has(key)) {
        addParam(key, value);
      }
    });
  }, []); // eslint-disable-line

  return {
    addParam,
    addParams,
    removeParam,
    queryParams: searchParams,
    is,
  };
}
