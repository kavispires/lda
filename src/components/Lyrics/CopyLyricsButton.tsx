import { CopyOutlined, SettingOutlined } from '@ant-design/icons';
import type { Distribution, Song } from '@types';
import { App, Button, Popover, Radio, Space, Typography } from 'antd';
import { useState } from 'react';
import { type AdlibMode, buildLyricsText, type DistributionMode, type SectionMode } from './copyLyricsUtils';

type CopyLyricsButtonProps = {
  song: Song;
  /**
   * When provided (Distribution edit page), enables the "Distribution" option, which
   * prefixes lines with the assigned artist name(s). Omit on the Song edit page.
   */
  distribution?: Distribution;
};

export function CopyLyricsButton({ song, distribution }: CopyLyricsButtonProps) {
  const { message } = App.useApp();
  const [sectionMode, setSectionMode] = useState<SectionMode>('minimal');
  const [adlibMode, setAdlibMode] = useState<AdlibMode>('minimal');
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('minimal');

  const handleCopyLyrics = () => {
    try {
      const text = buildLyricsText(song, {
        sectionMode,
        adlibMode,
        distribution: distribution
          ? { mapping: distribution.mapping, assignees: distribution.assignees, mode: distributionMode }
          : undefined,
      });
      navigator.clipboard.writeText(text);
      message.success('Lyrics copied to clipboard!');
    } catch {
      message.error('Failed to copy lyrics to clipboard');
    }
  };

  return (
    <Space.Compact>
      <Popover
        content={
          <Space direction="vertical" size="middle">
            <div>
              <Typography.Text strong>Sections</Typography.Text>
              <br />
              <Radio.Group
                onChange={(e) => setSectionMode(e.target.value)}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Minimal', value: 'minimal' },
                  { label: 'None', value: 'none' },
                ]}
                optionType="button"
                value={sectionMode}
              />
            </div>

            <div>
              <Typography.Text strong>Ad-libs</Typography.Text>
              <br />
              <Radio.Group
                onChange={(e) => setAdlibMode(e.target.value)}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Minimal', value: 'minimal' },
                  { label: 'None', value: 'none' },
                ]}
                optionType="button"
                value={adlibMode}
              />
            </div>

            {distribution && (
              <div>
                <Typography.Text strong>Distribution</Typography.Text>
                <br />
                <Radio.Group
                  onChange={(e) => setDistributionMode(e.target.value)}
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Minimal', value: 'minimal' },
                    { label: 'None', value: 'none' },
                  ]}
                  optionType="button"
                  value={distributionMode}
                />
              </div>
            )}
          </Space>
        }
        placement="bottomLeft"
        title="Copy Lyrics Options"
        trigger="click"
      >
        <Button icon={<SettingOutlined />} size="large" />
      </Popover>
      <Button icon={<CopyOutlined />} onClick={handleCopyLyrics} size="large">
        Copy Lyrics
      </Button>
    </Space.Compact>
  );
}
