import { Stage } from '@components/Formation/Stage';
import { ControlledVideo } from '@components/Video/ControlledVideo';
import { RATE, useDistributionVisualizerContext } from '@services/DistributionVisualizerProvider';
import type { FormationPose } from '@types';
import { activeFormationSingers, resolveFormationPose, STAGE_HEIGHT } from '@utils/formation';
import { Alert, Checkbox, Flex, Tooltip } from 'antd';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useMeasure, useMedia, useToggle } from 'react-use';
import { AdlibsScroller } from './AdlibsScroller';
import { BarsBox } from './BarsBox';
import { LyricsScroller } from './LyricsScroller';
import { SeekBar } from './SeekBar';
import { UpNext } from './UpNext';
import { VisualizerControls } from './VisualizerControls';
import { VisualizerMobile } from './VisualizerMobile';
import './Visualizer.scss';

export const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

export function Visualizer() {
  const [areControlsVisible, setControlsVisible] = useToggle(false);
  const isMobile = useMedia(MOBILE_MEDIA_QUERY, false);
  const [panels, setPanels] = useState({ formation: false, lyrics: true, bars: true });
  const [mirrorFormation, setMirrorFormation] = useState(false);
  const [lyricsRef, lyricsSize] = useMeasure<HTMLDivElement>();
  const {
    song,
    distribution,
    formation,
    formationError,
    formationLoading,
    hasFormation,
    fullScreenMode,
    videoControls,
    measurements,
    assignees,
    assigneesDict,
    barSnapshots,
    lyricsSnapshots,
    adlibsSnapshots,
    upNext,
    adlibUpNext,
    freshness,
  } = useDistributionVisualizerContext();
  const timestamp = Math.floor(videoControls.currentTime / RATE);
  const currentBarSnapshot = useMemo(() => {
    if (barSnapshots[timestamp]) return barSnapshots[timestamp];
    const lastTimestamp = Math.max(...Object.keys(barSnapshots).map(Number));
    return barSnapshots[lastTimestamp];
  }, [barSnapshots, timestamp]);

  if (isMobile) return <VisualizerMobile currentBarSnapshot={currentBarSnapshot} timestamp={timestamp} />;

  const showFormation = panels.formation && !!formation && !formationError;
  const showLyrics = panels.lyrics || (!showFormation && !panels.bars);
  const activeCount = Number(showFormation) + Number(showLyrics) + Number(panels.bars);
  const currentPose: FormationPose =
    showFormation && formation ? resolveFormationPose(formation.snapshots, videoControls.currentTime) : {};
  const stagePose = mirrorFormation
    ? Object.fromEntries(
        Object.entries(currentPose).map(([id, position]) => [
          id,
          { ...position, y: STAGE_HEIGHT - position.y },
        ]),
      )
    : currentPose;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover reveals existing playback controls
    <div
      className={clsx(
        'visualizer',
        fullScreenMode && 'visualizer--fullscreen',
        showFormation && 'visualizer--formation',
        !showFormation && !showLyrics && 'visualizer--bars-only',
      )}
      key={videoControls.refreshKey}
      onMouseEnter={() => setControlsVisible(true)}
      onMouseLeave={() => setControlsVisible(false)}
    >
      <VisualizerControls
        freshness={freshness}
        isVisible={areControlsVisible}
        songId={song.id}
        videoControls={videoControls}
      >
        <Flex className="visualizer__panels" gap={12} wrap>
          {hasFormation && (
            <Tooltip title={formationError ?? 'Show dance formation'}>
              <Checkbox
                checked={showFormation}
                disabled={formationLoading || !!formationError || (showFormation && activeCount === 1)}
                onChange={(event) => setPanels({ ...panels, formation: event.target.checked })}
              >
                Formation
              </Checkbox>
            </Tooltip>
          )}
          <Checkbox
            checked={showLyrics}
            disabled={showLyrics && activeCount === 1}
            onChange={(event) => setPanels({ ...panels, lyrics: event.target.checked })}
          >
            Lyrics
          </Checkbox>
          <Checkbox
            checked={panels.bars}
            disabled={panels.bars && activeCount === 1}
            onChange={(event) => setPanels({ ...panels, bars: event.target.checked })}
          >
            Bars
          </Checkbox>
          {hasFormation && (
            <Tooltip title="Flip front and back for practice without changing the saved formation">
              <Checkbox
                checked={mirrorFormation}
                disabled={!showFormation}
                onChange={(event) => setMirrorFormation(event.target.checked)}
              >
                Mirror formation
              </Checkbox>
            </Tooltip>
          )}
        </Flex>
      </VisualizerControls>
      <div className="visualizer__stats">
        <SeekBar className="visualizer__seek-bar" videoControls={videoControls} />
        {formationError && hasFormation && (
          <Alert description={formationError} showIcon title="Formation needs review" type="warning" />
        )}
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
            setEnd={videoControls.setEnd}
            setPlaying={videoControls.setPlaying}
            videoId={song.videoId}
            width={showFormation ? Math.min(measurements.stats.width, 320) : measurements.stats.width}
          />
        </div>
        {panels.bars && (
          <div className="distribution__bars">
            <BarsBox assignees={assignees} snapshots={currentBarSnapshot} />
          </div>
        )}
      </div>
      <div className="visualizer__primary">
        {showFormation && formation && (
          <div aria-label="Dance formation playback" className="formation-playback" role="group">
            <Stage
              activeIds={activeFormationSingers(song, distribution, videoControls.currentTime)}
              artists={assigneesDict}
              frontAtTop={mirrorFormation}
              positions={stagePose}
            />
          </div>
        )}
        {showLyrics && (
          <div className="visualizer__distribution" ref={lyricsRef}>
            <LyricsScroller
              assignees={assigneesDict}
              lyricsSnapshots={lyricsSnapshots}
              maxHeight={Math.max(0, lyricsSize.height - 32)}
              songTitle={song.title}
              timestamp={timestamp}
            />
            <AdlibsScroller
              adlibsSnapshots={adlibsSnapshots}
              assignees={assigneesDict}
              maxHeight={lyricsSize.height}
              timestamp={timestamp}
            />
            <UpNext adlibUpNext={adlibUpNext} timestamp={timestamp} upNext={upNext} />
          </div>
        )}
      </div>
    </div>
  );
}
