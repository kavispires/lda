import { Button, Divider, Input, Space, Typography } from 'antd';
import { useCreateSongMutation } from 'hooks/useCreateSongMutation';
import { cloneDeep } from 'lodash';
import { useState } from 'react';
import { Song, UID } from 'types';
import { distributor } from 'utils';

import { DatabaseFilled, MessageFilled, NotificationFilled } from '@ant-design/icons';

import { NewSong } from '../NewSongPage';
import { NewSongQuickLog } from './NewSongQuickLog';

type StepTwoProps = {
  newSong: NewSong;
  updateNewSong: (data: Partial<NewSong>) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
};

export function StepTwo({ newSong, updateNewSong, setStep }: StepTwoProps) {
  const [song, setSong] = useState<Song>(
    distributor.generateSong({
      title: newSong.title,
      videoId: newSong.videoId,
      originalArtist: newSong.originalArtist,
      duration: newSong.duration,
    })
  );

  const [textarea, setTextarea] = useState<string>('Sample lyrics\nSample |lyrics\n\nSampleLyrics');
  const onParse = () => {
    setSong(buildSections(textarea, song));
  };

  const songMutation = useCreateSongMutation();

  return (
    <>
      <Typography.Title level={3}>Building Sections from Lyrics</Typography.Title>
      <Typography.Paragraph>
        Paste the lyrics and press enter to auto-generate the sections and lines.
        <br />
        An line break creates a Line, a double line break generates a Section, and <code>|</code> generates
        parts.
        <br />
        Click on each Section <DatabaseFilled />, Line <MessageFilled />, and Part <NotificationFilled /> to
        edit their options.
      </Typography.Paragraph>

      <div className="lyrics-textarea-container">
        <Input.TextArea
          placeholder="Insert lyrics here"
          className="lyrics-textarea-container__textarea"
          onChange={(e) => setTextarea(e.target.value)}
          value={textarea}
          autoSize={{ minRows: 10, maxRows: 30 }}
        />
        <NewSongQuickLog song={song} />
      </div>
      <Space className="my-4 container-center">
        <Button onClick={onParse}>Parse Lyrics</Button>
      </Space>
      {!!song.sectionIds.length && (
        <>
          <Divider />
          <Typography.Paragraph>
            After verifying if all parts, lines, and sections were built correctly, press the button below to
            create a database record so you can time the parts next.
          </Typography.Paragraph>
          <Space className="my-4 container-center">
            <Button
              type="primary"
              size="large"
              onClick={() => songMutation.mutate(song)}
              loading={songMutation.isPending}
            >
              Create Song
            </Button>
          </Space>
        </>
      )}
    </>
  );
}

const buildSections = (textarea: string, song: Song) => {
  const songCopy = cloneDeep(song);
  const content: Song['content'] = {};

  // Remove double spaces and first line and last line line breaks
  const filteredTextarea = textarea.split('\n').filter((entry, index, list) => {
    const line = entry.trim();
    // Empty lines
    if (line === '') {
      // First line
      if (index === 0) return false;
      // Last line is empty
      else if (index === list.length - 1) return false;
      // Double empty lines
      else if (list[index - 1]?.trim() === '') return false;
    }
    return true;
  });

  const sectionIds: UID[] = [];
  let lineIds: UID[] = [];
  let newSectionId = distributor.generateUniqueId('s', 2);

  filteredTextarea.forEach((entry, index, list) => {
    const line = entry.trim();
    // Whenever there's an empty line, it means a new session is about to start, so save the previous data
    if (line === '') {
      const newSection = distributor.generateSection({ id: newSectionId });
      newSection.linesIds = lineIds;
      sectionIds.push(newSectionId);
      content[newSectionId] = newSection;
      // Reset everything
      lineIds = [];
      newSectionId = distributor.generateUniqueId('s', 2);
    } else {
      const newLine = distributor.generateLine({ sectionId: newSectionId });
      // Split lines, create a part for each fragment
      const partsIds = entry
        .split('|')
        .map((part) => {
          const text = part?.trim() ?? '';
          if (text) {
            const newPart = distributor.generatePart({ text, lineId: newLine.id });
            content[newPart.id] = newPart;
            return newPart.id;
          }
          return undefined;
        })
        .filter(Boolean) as UID[];

      newLine.sectionId = newSectionId;
      newLine.partsIds = partsIds;
      lineIds.push(newLine.id);
      content[newLine.id] = newLine;
    }

    // Handle saving the last section
    if (index === list.length - 1 && lineIds.length) {
      const newSection = distributor.generateSection({
        id: newSectionId,
        linesIds: lineIds,
      });
      sectionIds.push(newSectionId);
      content[newSectionId] = newSection;
    }
  });

  // TODO: Should sort by startAt ?

  songCopy.content = content;
  songCopy.sectionIds = sectionIds;
  songCopy.updatedAt = Date.now();

  return songCopy;
};
