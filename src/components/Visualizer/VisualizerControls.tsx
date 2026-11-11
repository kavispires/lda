import {
  BackwardOutlined,
  ForwardOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import type { useVideoControls } from '@hooks/useVideoControls';
import type { DistributionFreshness } from '@services/DistributionVisualizerProvider';
import type { Song } from '@types';
import { getSectionSummary } from '@utils/song/section-getters';
import { Badge, Button, Popover, Segmented, Tooltip, Typography } from 'antd';
import clsx from 'clsx';
import { type ReactNode, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useKeyPressEvent } from 'react-use';

type VisualizerControlsProps = {
  isVisible: boolean;
  videoControls: ReturnType<typeof useVideoControls>;
  song: Song;
  freshness: DistributionFreshness;
  isMobile?: boolean;
  displayMode?: DisplayMode;
  onDisplayModeChange?: (mode: DisplayMode) => void;
  children?: ReactNode;
};

export type DisplayMode = 'regular' | 'barsOnly' | 'lyricsOnly';

const DISPLAY_MODE_OPTIONS: { label: string; value: DisplayMode }[] = [
  { label: 'Both', value: 'regular' },
  { label: 'Lyrics', value: 'lyricsOnly' },
  { label: 'Bars', value: 'barsOnly' },
];

export function VisualizerControls({
  videoControls,
  isVisible,
  song,
  freshness,
  isMobile = false,
  displayMode,
  onDisplayModeChange,
  children,
}: VisualizerControlsProps) {
  const { isPlaying, pauseVideo, playVideo, seekToStart, seekToEnd, seekTo, seekAndPlay, currentTime } =
    videoControls;
  const navigate = useNavigate();
  const { distributionId } = useParams();
  const sections = useMemo(
    () =>
      song.sectionIds
        .map((id) => getSectionSummary(id, song))
        .filter(
          (section) =>
            section.duration > 0 && section.startTime < song.endAt && section.endTime > song.startAt,
        )
        .map((section) => ({
          name: section.name.trim(),
          time: Math.max(song.startAt, section.startTime - 2000),
        }))
        .sort((a, b) => a.time - b.time)
        .filter((section, index, sections) => index === 0 || section.time > sections[index - 1].time),
    [song],
  );
  // Treat the lead-in as part of its section so repeated skips move to a new section.
  const sectionIndex = sections.findLastIndex((section) => section.time <= currentTime);
  const previousSection = sections[sectionIndex - 1];
  const nextSection = sections[sectionIndex + 1];
  const seekToSection = (time: number) => {
    if (isPlaying) seekAndPlay(time);
    else seekTo(time);
  };

  useKeyPressEvent(' ', () => {
    isPlaying ? pauseVideo() : playVideo();
  });

  return (
    <div
      aria-label="Visualizer controls"
      className={clsx(
        'visualizer-controls',
        isVisible && 'visualizer-controls--visible',
        isMobile && 'visualizer-controls--mobile',
      )}
      inert={!isVisible}
      onClick={(e) => e.stopPropagation()}
      role="group"
    >
      <div aria-label="Playback" className="visualizer-controls__playback" role="group">
        <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
          <Button
            aria-label={isPlaying ? 'Pause' : 'Play'}
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={isPlaying ? pauseVideo : playVideo}
            size="large"
            type="primary"
          />
        </Tooltip>
        <Tooltip title="Go to beginning">
          <Button
            aria-label="Go to beginning"
            ghost
            icon={<StepBackwardOutlined />}
            onClick={seekToStart}
            size="large"
          />
        </Tooltip>
        <Tooltip title="Go to end">
          <Button
            aria-label="Go to end"
            ghost
            icon={<StepForwardOutlined />}
            onClick={seekToEnd}
            size="large"
          />
        </Tooltip>
        <div className="visualizer-controls__section-navigation">
          <Tooltip title={previousSection ? `${previousSection.name} (2s lead-in)` : 'No previous section'}>
            <Button
              aria-label="Previous section"
              disabled={!previousSection}
              ghost
              icon={<BackwardOutlined />}
              onClick={() => previousSection && seekToSection(previousSection.time)}
              size="large"
            />
          </Tooltip>
          <Tooltip title={nextSection ? `${nextSection.name} (2s lead-in)` : 'No next section'}>
            <Button
              aria-label="Next section"
              disabled={!nextSection}
              ghost
              icon={<ForwardOutlined />}
              onClick={() => nextSection && seekToSection(nextSection.time)}
              size="large"
            />
          </Tooltip>
        </div>
      </div>
      {(children || (isMobile && displayMode && onDisplayModeChange)) && (
        <div aria-label="Visualization" className="visualizer-controls__visualization" role="group">
          <span className="visualizer-controls__label">Show</span>
          {isMobile && displayMode && onDisplayModeChange && (
            <Segmented
              className="visualizer-controls__display-mode"
              onChange={onDisplayModeChange}
              options={DISPLAY_MODE_OPTIONS}
              value={displayMode}
            />
          )}
          {children}
        </div>
      )}
      <div className="visualizer-controls__edit">
        <Button onClick={() => navigate(`/distributions/${distributionId}/edit`)} size="small">
          Edit distribution
        </Button>
        <Button onClick={() => navigate(`/songs/${song.id}/edit`)} size="small">
          Edit song
        </Button>
        {freshness.outdated && (
          <Popover
            content={
              <div>
                <Typography.Title level={4}>Distribution is outdated</Typography.Title>
                {freshness.missingParts.length > 0 && (
                  <Typography.Paragraph>
                    There are {freshness.missingParts.length} extra parts that need to be assigned. Edit the
                    song to do so.
                  </Typography.Paragraph>
                )}
                {freshness.extraParts.length > 0 && (
                  <Typography.Paragraph>
                    There are {freshness.extraParts.length} parts that are no longer in the song. Save the
                    song so they can be automatically removed.
                  </Typography.Paragraph>
                )}
              </div>
            }
            trigger="click"
          >
            <Button aria-label="Distribution is outdated" type="text">
              <Badge size="default" status="error" />
            </Button>
          </Popover>
        )}
      </div>
    </div>
  );
}
