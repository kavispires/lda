import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import type { useVideoControls } from '@hooks/useVideoControls';
import type { DistributionFreshness } from '@services/DistributionVisualizerProvider';
import { Badge, Button, Popover, Segmented, Typography } from 'antd';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useKeyPressEvent } from 'react-use';

type VisualizerControlsProps = {
  isVisible: boolean;
  className?: string;
  videoControls: ReturnType<typeof useVideoControls>;
  songId: string;
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
  songId,
  freshness,
  isMobile = false,
  displayMode,
  onDisplayModeChange,
  children,
}: VisualizerControlsProps) {
  const { isPlaying, pauseVideo, playVideo, seekToStart, seekToEnd, onRestart } = videoControls;
  const navigate = useNavigate();
  const { distributionId } = useParams();

  useKeyPressEvent(' ', () => {
    isPlaying ? pauseVideo() : playVideo();
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: stops taps from toggling the controls on mobile
    <div
      className={clsx(
        'visualizer-controls',
        isVisible && 'visualizer-controls--visible',
        isMobile && 'visualizer-controls--mobile',
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {isMobile && displayMode && onDisplayModeChange && (
        <Segmented
          className="visualizer-controls__display-mode"
          onChange={onDisplayModeChange}
          options={DISPLAY_MODE_OPTIONS}
          value={displayMode}
        />
      )}
      <Button onClick={onRestart}>
        <UndoOutlined />
      </Button>
      <Button ghost onClick={isPlaying ? pauseVideo : playVideo}>
        {videoControls.isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
      </Button>
      <Button ghost onClick={seekToStart}>
        <StepBackwardOutlined />
      </Button>
      <Button ghost onClick={seekToEnd}>
        <StepForwardOutlined />
      </Button>
      <Button onClick={() => navigate(`/distributions/${distributionId}/edit`)}>Edit Distribution</Button>
      <Button onClick={() => navigate(`/songs/${songId}/edit`)}>Edit Song</Button>
      {children}
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
                  There are {freshness.extraParts.length} parts that are no longer in the song. Save the song
                  so they can be automatically removed.
                </Typography.Paragraph>
              )}
            </div>
          }
          trigger="click"
        >
          <Button type="text">
            <Badge size="default" status="error" />
          </Button>
        </Popover>
      )}
    </div>
  );
}
