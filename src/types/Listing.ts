import type { FUID } from './common';

export type ListingEntry<TData = unknown> = {
  id: FUID;
  name: string;
  type: string;
  updatedAt?: number;
  data?: TData;
};
