import { ControlledVideo } from '@components/Video/ControlledVideo';
import {
  type AssigneeSnapshot,
  useDistributionVisualizerContext,
} from '@services/DistributionVisualizerProvider';
import type { Dictionary } from '@types';
import { useMeasure, useToggle } from 'react-use';
import { AdlibsScroller } from './AdlibsScroller';
import { BarsBox } from './BarsBox';
import { LyricsScroller } from './LyricsScroller';
import { SeekBar } from './SeekBar';
import { UpNext } from './UpNext';
import { VisualizerControls } from './VisualizerControls';

type VisualizerMobileProps = {
  currentBarSnapshot: Dictionary<AssigneeSnapshot>;
  timestamp: number;
};

const MOBILE_ADLIBS_MAX_HEIGHT = 72;

export function VisualizerMobile({ currentBarSnapshot, timestamp }: VisualizerMobileProps) {
  const [areControlsVisible, toggleControls] = useToggle(false);
  const [lyricsRef, { height: lyricsHeight }] = useMeasure<HTMLDivElement>();

  const {
    song,
    videoControls,
    displayMode,
    setDisplayMode,
    assignees,
    assigneesDict,
    lyricsSnapshots,
    adlibsSnapshots,
    upNext,
    adlibUpNext,
    freshness,
  } = useDistributionVisualizerContext();

  const showBars = displayMode !== 'lyricsOnly';
  const showLyrics = displayMode !== 'barsOnly';

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: tapping anywhere toggles the controls
    <div className="visualizer-mobile" key={videoControls.refreshKey} onClick={() => toggleControls()}>
      <div
        className="visualizer-mobile__backdrop"
        style={{ backgroundImage: `url(https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg)` }}
      />
      <div className="visualizer-mobile__overlay" />

      {/* Kept mounted (but off-screen) since it drives the playback and timing */}
      <ControlledVideo
        className="visualizer-mobile__video"
        hideControls
        onStateChange={videoControls.onStateChange}
        playerRef={videoControls.playerRef}
        setEnd={() => {}}
        setPlaying={() => {}}
        videoId={song.videoId}
        width={320}
      />

      <div className="visualizer-mobile__content">
        <SeekBar className="visualizer-mobile__seek-bar" videoControls={videoControls} />
        <div className="visualizer-mobile__title">
          <h3>{song.title}</h3>
          <p>{song.originalArtist}</p>
        </div>

        {showBars && (
          <div
            className={
              showLyrics ? 'visualizer-mobile__bars' : 'visualizer-mobile__bars visualizer-mobile__bars--full'
            }
          >
            <BarsBox assignees={assignees} compact={showLyrics} snapshots={currentBarSnapshot} />
          </div>
        )}

        {showLyrics && (
          <div className="visualizer-mobile__lyrics" ref={lyricsRef}>
            <LyricsScroller
              assignees={assigneesDict}
              centered={!showBars}
              lyricsSnapshots={lyricsSnapshots}
              maxHeight={Math.max(lyricsHeight - MOBILE_ADLIBS_MAX_HEIGHT, 0)}
              songTitle={song.title}
              timestamp={timestamp}
            />
            <div className="visualizer-mobile__adlibs">
              <AdlibsScroller
                adlibsSnapshots={adlibsSnapshots}
                assignees={assigneesDict}
                maxHeight={MOBILE_ADLIBS_MAX_HEIGHT}
                timestamp={timestamp}
              />
            </div>
          </div>
        )}

        <div className="visualizer-mobile__up-next">
          <UpNext adlibUpNext={adlibUpNext} timestamp={timestamp} upNext={upNext} />
        </div>
      </div>

      <VisualizerControls
        displayMode={displayMode}
        freshness={freshness}
        isMobile
        isVisible={areControlsVisible}
        onDisplayModeChange={setDisplayMode}
        songId={song.id}
        videoControls={videoControls}
      />
    </div>
  );
}
