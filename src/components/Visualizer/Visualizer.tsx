import clsx from 'clsx';
import { RATE, useDistributionVisualizerContext } from 'services/DistributionVisualizerProvider';
import './Visualizer.scss';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { VideoControls } from 'components/Video/VideoControls';
import { BarsBox } from './BarsBox';

export function Visualizer() {
  const { song, fullScreenMode, videoControls, measurements, assignees, barSnapshots } =
    useDistributionVisualizerContext();
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
          <BarsBox
            assignees={assignees}
            snapshots={barSnapshots[Math.floor(videoControls.currentTime / RATE)]}
          />
        </div>
      </div>

      <div className="visualizer__distribution">
        <div className="visualizer__lyrics">
          <p>Lyrics</p>
        </div>
        <div className="visualizer__add-libs">
          <p>Adlibs</p>
        </div>
      </div>
    </div>
  );
}
