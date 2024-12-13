import clsx from 'clsx';
import { RATE, useDistributionVisualizerContext } from 'services/DistributionVisualizerProvider';
import './Visualizer.scss';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { BarsBox } from './BarsBox';
import { LyricsScroller } from './LyricsScroller';
import { AdlibsScroller } from './AdlibsScroller';
import { UpNext } from './UpNext';
import { SeekBar } from './SeekBar';
import { VisualizerControls } from './VisualizerControls';
import { useToggle } from 'react-use';

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
    <div
      className={clsx('visualizer', fullScreenMode && 'visualizer--fullscreen')}
      onMouseEnter={() => setControlsVisible(true)}
      onMouseLeave={() => setControlsVisible(false)}
      key={videoControls.refreshKey}
    >
      <VisualizerControls isVisible={areControlsVisible} videoControls={videoControls} songId={song.id} />
      <div className="visualizer__stats">
        <SeekBar videoControls={videoControls} className="visualizer__seek-bar" />
        <div className="visualizer__metadata">
          <div className="visualizer__title">
            <h3>{song.title}</h3>
            <p>{song.originalArtist}</p>
          </div>
          <ControlledVideo
            width={measurements.stats.width}
            videoId={song.videoId}
            playerRef={videoControls.playerRef}
            setPlaying={() => {}}
            setEnd={() => {}}
            className="visualizer__video"
            hideControls
            onStateChange={videoControls.onStateChange}
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
          timestamp={timestamp}
          songTitle={song.title}
          maxHeight={measurements.distribution.height - 32}
        />

        <AdlibsScroller
          assignees={assigneesDict}
          adlibsSnapshots={adlibsSnapshots}
          timestamp={timestamp}
          maxHeight={measurements.distribution.height}
        />

        <UpNext upNextSnapshots={upNextSnapshots} timestamp={timestamp} />
      </div>
    </div>
  );
}
