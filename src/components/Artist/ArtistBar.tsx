import './ArtistBar.scss';

import clsx from 'clsx';
import { forwardRef, ReactNode } from 'react';
import { Artist } from 'types';

import { ArtistAvatar } from './ArtistAvatar';

type ArtistBarProps = {
  artist: Artist;
  progress: Number;
  value: ReactNode;
  active?: boolean;
  idle?: boolean;
  fixed?: boolean;
} & React.ComponentPropsWithRef<'div'>;

export const ArtistBar = forwardRef<HTMLDivElement, ArtistBarProps>(
  ({ artist, progress, value, active, idle, fixed, className, ...props }: ArtistBarProps) => {
    return (
      <div
        id={artist.id}
        className={clsx(
          'bar',
          active && 'bar--active',
          idle && 'bar--idle',
          fixed && 'bar--fixed',
          className
        )}
        {...props}
      >
        <div className="bar__avatar">
          <ArtistAvatar
            id={artist.id}
            name={artist.name}
            style={{
              border: `3px solid ${artist.color}`,
            }}
          />
        </div>

        <div className="bar__data">
          <div className="bar__artist">
            <span className="bar__name">{artist.name}</span>•
            <span className="bar__track">{artist.track}</span>
          </div>
          <div className="bar__bar">
            <span
              className="bar__progress"
              style={{ width: `${progress}%`, backgroundColor: artist.color }}
            />
            <span className="bar__progress-gutter" />
          </div>
        </div>

        <pre className="bar__timestamp">{value}</pre>
      </div>
    );
  }
);