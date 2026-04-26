import './DistributionStatsBar.scss';

import { Flex, Tooltip } from 'antd';
import clsx from 'clsx';
import { ArtistAvatar } from 'components/Artist';
import type { Artist } from 'types';

type DistributionStatsBarProps = {
  artist: Artist;
  totalDuration: number;
  regularDuration: number;
  adlibDuration: number;
  totalPercentage: number;
  regularPercentage: number;
  adlibPercentage: number;
  totalSongPercentage: number;
  regularSongPercentage: number;
  adlibSongPercentage: number;
  className?: string;
  onClick?: () => void;
};

export function DistributionStatsBar({
  artist,
  totalDuration,
  regularDuration,
  adlibDuration,
  totalPercentage,
  regularPercentage,
  adlibPercentage,
  totalSongPercentage,
  regularSongPercentage,
  adlibSongPercentage,
  className,
  onClick,
}: DistributionStatsBarProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: I need this
    <div
      className={clsx('distribution-stats-bar', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="distribution-stats-bar__avatar">
        <ArtistAvatar
          id={artist.id}
          name={artist.name}
          style={{
            border: `0.25em solid ${artist.color}`,
          }}
        />
      </div>

      <div className="distribution-stats-bar__data">
        <div className="distribution-stats-bar__artist">
          <span className="distribution-stats-bar__name">{artist.name}</span>•
          <span className="distribution-stats-bar__track">{artist.track}</span>
        </div>

        {/* Total Bar */}
        <div className="distribution-stats-bar__row">
          <Tooltip
            title={
              <Flex gap={4} orientation="vertical">
                <span>Total: {totalSongPercentage.toFixed(1)}%</span>
                <span>Regular: {regularSongPercentage.toFixed(1)}%</span>
                <span>Adlibs: {adlibSongPercentage.toFixed(1)}%</span>
              </Flex>
            }
          >
            <div className="distribution-stats-bar__bar distribution-stats-bar__bar--full">
              <span
                className="distribution-stats-bar__progress"
                style={{ width: `${Math.min(regularPercentage, 100)}%`, backgroundColor: artist.color }}
              />
              <span
                className="distribution-stats-bar__progress distribution-stats-bar__progress--adlib"
                style={{ width: `${Math.min(totalPercentage, 100)}%`, backgroundColor: artist.color }}
              />
              <span className="distribution-stats-bar__gutter" />
            </div>
          </Tooltip>
          <pre className="distribution-stats-bar__value">{totalDuration}s</pre>
        </div>

        {/* Regular Lines Bar */}
        <div className="distribution-stats-bar__row">
          <Tooltip title={`Regular lines: ${regularSongPercentage.toFixed(1)}%`}>
            <div className="distribution-stats-bar__bar distribution-stats-bar__bar--thin">
              <span
                className="distribution-stats-bar__progress"
                style={{ width: `${Math.min(regularPercentage, 100)}%`, backgroundColor: artist.color }}
              />
              <span className="distribution-stats-bar__gutter" />
            </div>
          </Tooltip>
          <pre className="distribution-stats-bar__value distribution-stats-bar__value--small">
            {regularDuration}s
          </pre>
        </div>

        {/* Adlibs Bar */}
        <div className="distribution-stats-bar__row">
          <Tooltip title={`Adlibs: ${adlibSongPercentage.toFixed(1)}%`}>
            <div className="distribution-stats-bar__bar distribution-stats-bar__bar--thin">
              <span
                className="distribution-stats-bar__progress distribution-stats-bar__progress--adlib"
                style={{ width: `${Math.min(adlibPercentage, 100)}%`, backgroundColor: artist.color }}
              />
              <span className="distribution-stats-bar__gutter" />
            </div>
          </Tooltip>
          <pre className="distribution-stats-bar__value distribution-stats-bar__value--small">
            {adlibDuration}s
          </pre>
        </div>
      </div>
    </div>
  );
}
