import { getDocQueryFunction, updateDocQueryFunction } from '@services/firebase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FUID, GroupStats, ListingEntry } from '@types';
import { App } from 'antd';
import { orderBy } from 'lodash';

type MemberRankingCount = {
  memberId: FUID;
  memberName: string;
  count: number;
};

export function useCalculateGroupStatsMutation() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation<GroupStats, Error, FUID>({
    mutationFn: async (groupId: string) => {
      // Get all distribution listings
      const listings = await getDocQueryFunction<Record<string, ListingEntry>>('listings', 'distributions');

      // Filter distributions by groupId from listing data
      const groupDistributions = Object.values(listings).filter((entry) => {
        const data = entry.data as any;
        return data?.groupId === groupId;
      });

      if (groupDistributions.length === 0) {
        throw new Error('No distributions found for this group');
      }

      // Track counts for each position
      const firstCounts: Record<string, MemberRankingCount> = {};
      const secondCounts: Record<string, MemberRankingCount> = {};
      const lastCounts: Record<string, MemberRankingCount> = {};

      // Parse each distribution's snippet
      for (const distribution of groupDistributions) {
        const snippet = (distribution.data as any)?.snippet;
        if (!snippet) continue;

        // Parse snippet: "#color|percentage|name::..."
        const members = snippet.split('::').map((segment: string) => {
          const [color, percentage, name] = segment.split('|');
          return { color, percentage: Number.parseFloat(percentage), name };
        });

        // Sort by percentage descending to get rankings
        const ranked = orderBy(members, ['percentage'], ['desc']);

        if (ranked.length === 0) continue;

        // Track first place
        if (ranked[0]) {
          const name = ranked[0].name;
          if (!firstCounts[name]) {
            firstCounts[name] = { memberId: '', memberName: name, count: 0 };
          }
          firstCounts[name].count++;
        }

        // Track second place
        if (ranked[1]) {
          const name = ranked[1].name;
          if (!secondCounts[name]) {
            secondCounts[name] = { memberId: '', memberName: name, count: 0 };
          }
          secondCounts[name].count++;
        }

        // Track last place
        if (ranked.length > 0) {
          const name = ranked[ranked.length - 1].name;
          if (!lastCounts[name]) {
            lastCounts[name] = { memberId: '', memberName: name, count: 0 };
          }
          lastCounts[name].count++;
        }
      }

      const totalDistributions = groupDistributions.length;

      // Find member with most occurrences in each position
      const getMostFrequent = (counts: Record<string, MemberRankingCount>) => {
        const sorted = orderBy(Object.values(counts), ['count', 'memberName'], ['desc', 'asc']);
        if (sorted.length === 0) return null;

        const top = sorted[0];
        return {
          memberId: top.memberId, // Will be empty, but we keep structure consistent
          memberName: top.memberName,
          count: top.count,
          percentage: Number(((top.count / totalDistributions) * 100).toFixed(1)),
        };
      };

      const stats: GroupStats = {
        mostFirst: getMostFrequent(firstCounts),
        mostSecond: getMostFrequent(secondCounts),
        mostLast: getMostFrequent(lastCounts),
        totalDistributions,
        lastUpdated: Date.now(),
      };

      // Update group document with stringified stats
      await updateDocQueryFunction('listings', 'groups', {
        [`${groupId}.data.stats`]: JSON.stringify(stats),
      });

      return stats;
    },
    onSuccess(stats, groupId) {
      notification.success({
        title: 'Stats Calculated',
        description: `Updated stats for ${stats.totalDistributions} distributions`,
      });

      // Invalidate groups query to refresh data
      queryClient.invalidateQueries({
        queryKey: ['listings', 'groups'],
      });
    },
    onError(error) {
      notification.error({
        title: 'Calculation Error',
        description: error.message,
      });
    },
  });
}
