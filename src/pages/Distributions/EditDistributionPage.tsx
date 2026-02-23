import './EditDistributionPage.scss';

import { CopyOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Flex, Progress, Space, Typography } from 'antd';
import { Content } from 'components/Content';
import { DistributionLog } from 'components/Log/DistributionLog';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { VideoControls } from 'components/Video/VideoControls';
import { useNavigate } from 'react-router-dom';
import { useMeasure } from 'react-use';
import { SongDistributionProvider, useSongDistributionContext } from 'services/SongDistributionProvider';
import type { Song } from 'types';
import { distributor } from 'utils';
import { DistributionLiveStats } from './DistributionLiveStats';

export function EditDistributionPage() {
  return (
    <SongDistributionProvider>
      <EditDistributionContent />
    </SongDistributionProvider>
  );
}

function EditDistributionContent() {
  const { song, group, videoControls, mappingProgress, onSave, isSaving, distribution } =
    useSongDistributionContext();
  const navigate = useNavigate();
  const [ref, { width }] = useMeasure<HTMLElement>();
  const { message } = App.useApp();

  const handleCopyLyrics = () => {
    copyDistributionToClipboard(song, message);
  };

  return (
    <Content ref={ref}>
      <Flex align="center" justify="space-between">
        <Typography.Title level={2}>
          Edit Distribution: <em>{group.name}</em> sings <em>{song.title}</em>
        </Typography.Title>
        <div>?</div>
      </Flex>

      <Space className="w-100" orientation="vertical" size="small">
        <Progress className="w-100" percent={mappingProgress} />
      </Space>

      <div className="distributor">
        <div>
          <VideoControls className="distributor__controls" videoControls={videoControls} />
          <div className="distributor__metadata">
            <ControlledVideo
              className="distributor__video"
              hideControls
              onStateChange={videoControls.onStateChange}
              playerRef={videoControls.playerRef}
              setEnd={() => {}}
              setPlaying={() => {}}
              videoId={song.videoId}
              width={Math.min(width / 2 - 12, 320)}
            />
            <div className="visualizer__title">
              <h3>{song.title}</h3>
              <p>{group.name}</p>
            </div>
          </div>

          <div className="mt-4 surface">
            <DistributionLiveStats />
          </div>
        </div>

        <DistributionLog />
      </div>
      <Flex className="surface my-2" justify="space-between">
        <Space>
          <Button icon={<SaveOutlined />} loading={isSaving} onClick={onSave} size="large" type="primary">
            Save
          </Button>
          <Button onClick={() => navigate(`/distributions/${distribution.id}`)} size="large">
            View
          </Button>
        </Space>

        <Space.Compact>
          <Button icon={<CopyOutlined />} onClick={handleCopyLyrics} size="large">
            Copy Lyrics
          </Button>
          <Button disabled icon={<CopyOutlined />} onClick={() => {}} size="large">
            Copy Lyrics Distributions
          </Button>
        </Space.Compact>
      </Flex>
    </Content>
  );
}

function copyDistributionToClipboard(song: Song, message: ReturnType<typeof App.useApp>['message']) {
  try {
    // Get all sections in order
    const sections = distributor.getAllSections(song);

    // Build formatted text
    const formattedText = sections
      .map((section) => {
        // Format section header
        const sectionHeader = `[${section.kind.toUpperCase()} ${section.number}]`;

        // Get all lines in this section
        const lines = section.linesIds
          .map((lineId) => {
            const line = song.content[lineId];
            if (line.type !== 'line') return '';

            // Get all parts in the line and join their text
            const partsText = line.partsIds
              .map((partId) => {
                const part = song.content[partId];
                if (part.type !== 'part') return '';
                return part.text;
              })
              .filter(Boolean)
              .join(' ');

            return partsText;
          })
          .filter(Boolean);

        // Combine section header with lines
        return `${sectionHeader}\n${lines.join('\n')}`;
      })
      .join('\n\n');

    // Copy to clipboard
    navigator.clipboard.writeText(formattedText);
    message.success('Lyrics copied to clipboard!');
  } catch {
    message.error('Failed to copy lyrics to clipboard');
  }
}
