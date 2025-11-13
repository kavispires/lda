import './ArtistBar.scss';

import { PushpinFilled } from '@ant-design/icons';
import clsx from 'clsx';
import { forwardRef } from 'react';
import type { Artist } from 'types';
import { ArtistAvatar } from './ArtistAvatar';

type ArtistBarProps = {
  artist: Artist;
  progress: number;
  fullProgress: number;
  value: string;
  active?: boolean;
  idle?: boolean;
  fixed?: boolean;
  done?: boolean;
} & React.ComponentPropsWithRef<'div'>;

export const ArtistBar = forwardRef<HTMLDivElement, ArtistBarProps>(
  ({
    artist,
    progress,
    value,
    active,
    idle,
    fixed,
    className,
    done,
    fullProgress,
    ...props
  }: ArtistBarProps) => {
    return (
      <div
        className={clsx(
          'bar',
          active && 'bar--active',
          idle && 'bar--idle',
          fixed && 'bar--fixed',
          className,
        )}
        id={artist.id}
        {...props}
      >
        <div className="bar__avatar">
          <ArtistAvatar
            id={artist.id}
            name={artist.name}
            style={{
              border: `0.25em solid ${done ? '#ccc' : artist.color}`,
            }}
          />
        </div>

        <div className="bar__data">
          <div className="bar__artist">
            <span className="bar__name">
              {artist.name} {done && <PushpinFilled className="bar__avatar-done" />}
            </span>
            •<span className="bar__track">{artist.track}</span>
          </div>
          <div className="bar__bar">
            <span
              className="bar__progress"
              style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: artist.color }}
            />
            <span
              className="bar__full-progress"
              style={{ width: `${Math.min(fullProgress, 100)}%`, backgroundColor: artist.color }}
            />
            <span className="bar__progress-gutter" />
          </div>
        </div>

        <pre className="bar__timestamp">{value}</pre>
      </div>
    );
  },
);
