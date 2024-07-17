import clsx from 'clsx';
import { RATE, useDistributionVisualizerContext } from 'services/DistributionVisualizerProvider';
import './Visualizer.scss';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { VideoControls } from 'components/Video/VideoControls';
import { BarsBox } from './BarsBox';
import { LyricsScroller } from './LyricsScroller';
import { AdlibsScroller } from './AdlibsScroller';

export function Visualizer() {
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
  } = useDistributionVisualizerContext();
  /**
   * TODO:
   * View:
   * - Full screen mode
   *  - Bar only mode
   *  - Lyrics only mode
   * Controls:
   * - Seek bar
   * - Play/Pause
   * - Restart
   * - Results
   * Adjustments
   * - Font size
   * - Light mode?
   * - Display dismissible
   */

  const timestamp = Math.floor(videoControls.currentTime / RATE);

  return (
    <div className={clsx('visualizer', fullScreenMode && 'visualizer--fullscreen')}>
      <div className="visualizer__stats">
        <VideoControls videoControls={videoControls} className="visualizer__controls" />
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
          maxHeight={measurements.distribution.height}
        />

        <AdlibsScroller
          assignees={assigneesDict}
          adlibsSnapshots={adlibsSnapshots}
          timestamp={timestamp}
          maxHeight={measurements.distribution.height}
        />
      </div>
    </div>
  );
}
