import { ArtistAvatar } from '@components/Artist';
import type { Distribution, Song } from '@types';
import { ALL_ID, NONE_ID } from '@utils/constants';
import { getLineStartTime } from '@utils/song/line-getters';
import { getPart } from '@utils/song/part-getters';
import { getSectionSummary } from '@utils/song/section-getters';
import { Tag, Typography } from 'antd';
import clsx from 'clsx';
import { useMemo } from 'react';

export function CurrentSectionDistribution({
  song,
  distribution,
  timestamp,
  onSeek,
}: {
  song: Song;
  distribution: Pick<Distribution, 'assignees' | 'mapping'>;
  timestamp: number;
  onSeek: (timestamp: number) => void;
}) {
  const sections = useMemo(
    () =>
      song.sectionIds.flatMap((id) => {
        const summary = getSectionSummary(id, song);
        const parts = summary.partIds
          .map((partId) => getPart(partId, song))
          .filter(
            (part) =>
              Number.isFinite(part.startTime) &&
              Number.isFinite(part.endTime) &&
              part.endTime > part.startTime,
          );
        if (!parts.length) return [];
        return [
          {
            ...summary,
            startTime: Math.min(...parts.map((part) => part.startTime)),
            endTime: Math.max(...parts.map((part) => part.endTime)),
          },
        ];
      }),
    [song],
  );
  const current =
    timestamp >= song.startAt && timestamp < song.endAt
      ? sections
          .filter((section) => timestamp >= section.startTime && timestamp < section.endTime)
          .sort((a, b) => b.startTime - a.startTime)[0]
      : undefined;

  return (
    <section aria-label="Current section distribution" className="formation-section">
      <Typography.Title level={5}>Current section{current ? `: ${current.name}` : ''}</Typography.Title>
      {current ? (
        <ul className="formation-section__lines">
          {current.lines.map((line) => (
            <li
              className={clsx('formation-section__line', line.adlib && 'formation-section__line--adlib')}
              key={line.id}
            >
              <button
                className="formation-section__seek"
                disabled={!line.partsIds.length}
                onClick={() => onSeek(getLineStartTime(line.id, song))}
                title="Seek to beginning of line"
                type="button"
              >
                {line.adlib && <Tag>{line.inline ? 'Inline adlib' : 'Adlib'}</Tag>}
                {line.harmonyOf && <Tag>Harmony</Tag>}
                {line.dismissible && <Tag>Hidden lyric</Tag>}
                <span className="formation-section__parts">
                  {line.partsIds.map((id) => {
                    const part = getPart(id, song);
                    const active = timestamp >= part.startTime && timestamp < part.endTime;
                    const assignments = distribution.mapping[id] ?? [];
                    return (
                      <span
                        aria-current={active ? 'true' : undefined}
                        className="formation-section__part"
                        key={id}
                      >
                        <span className="formation-section__text">{part.text}</span>
                        <span className="formation-section__assignees">
                          {assignments.length ? (
                            assignments.map((assigneeId) => {
                              const artist = distribution.assignees[assigneeId];
                              const special = assigneeId === ALL_ID || assigneeId === NONE_ID;
                              return (
                                <span className="formation-section__assignee" key={assigneeId}>
                                  {!special && artist && (
                                    <ArtistAvatar
                                      contestantImageId={artist.contestantImageId}
                                      id={assigneeId}
                                      name={artist.name}
                                      size={18}
                                      style={{ border: `2px solid ${artist.color}` }}
                                    />
                                  )}
                                  {special ? assigneeId : (artist?.name ?? assigneeId)}
                                </span>
                              );
                            })
                          ) : (
                            <Typography.Text type="secondary">Unassigned</Typography.Text>
                          )}
                        </span>
                      </span>
                    );
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Typography.Text type="secondary">No section at this playhead.</Typography.Text>
      )}
    </section>
  );
}
