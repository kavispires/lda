import clsx from 'clsx';
import { RATE, useDistributionVisualizerContext } from 'services/DistributionVisualizerProvider';
import './Visualizer.scss';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { useToggle } from 'react-use';
import { AdlibsScroller } from './AdlibsScroller';
import { BarsBox } from './BarsBox';
import { LyricsScroller } from './LyricsScroller';
import { SeekBar } from './SeekBar';
import { UpNext } from './UpNext';
import { VisualizerControls } from './VisualizerControls';

export function Visualizer() {
  const [areControlsVisible, setControlsVisible] = useToggle(false);

  const {
    song,
    fullScreenMode,
    videoControls,
    measurements,
    assignees,
    assigneesDict,
    barSnapshots,
    lyricsSnapshots,
    adlibsSnapshots,
    upNextSnapshots,
    freshness,
  } = useDistributionVisualizerContext();
  /**
   * TODO:
   * View:
   * - Full screen mode
   *  - Bar only mode
   *  - Lyrics only mode
   * Controls:
   * - Restart
   * - Results
   * Adjustments
   * - Font size
   * - Light mode?
   * - Display dismissible
   */

  const timestamp = Math.floor(videoControls.currentTime / RATE);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: TODO
    <div
      className={clsx('visualizer', fullScreenMode && 'visualizer--fullscreen')}
      key={videoControls.refreshKey}
      onMouseEnter={() => setControlsVisible(true)}
      onMouseLeave={() => setControlsVisible(false)}
    >
      <VisualizerControls
        freshness={freshness}
        isVisible={areControlsVisible}
        songId={song.id}
        videoControls={videoControls}
      />
      <div className="visualizer__stats">
        <SeekBar className="visualizer__seek-bar" videoControls={videoControls} />
        <div className="visualizer__metadata">
          <div className="visualizer__title">
            <h3>{song.title}</h3>
            <p>{song.originalArtist}</p>
          </div>
          <ControlledVideo
            className="visualizer__video"
            hideControls
            onStateChange={videoControls.onStateChange}
            playerRef={videoControls.playerRef}
            setEnd={() => {}}
            setPlaying={() => {}}
            videoId={song.videoId}
            width={measurements.stats.width}
          />
        </div>
        <div className="distribution__bars">
          <BarsBox assignees={assignees} snapshots={barSnapshots[timestamp]} />
        </div>
      </div>

      <div className="visualizer__distribution">
        <LyricsScroller
          assignees={assigneesDict}
          lyricsSnapshots={lyricsSnapshots}
          maxHeight={measurements.distribution.height - 32}
          songTitle={song.title}
          timestamp={timestamp}
        />

        <AdlibsScroller
          adlibsSnapshots={adlibsSnapshots}
          assignees={assigneesDict}
          maxHeight={measurements.distribution.height}
          timestamp={timestamp}
        />

        <UpNext timestamp={timestamp} upNextSnapshots={upNextSnapshots} />
      </div>
    </div>
  );
}
