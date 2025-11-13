import './NewSongPage.scss';

import { Typography } from 'antd';
import { Content } from 'components/Content';
import { useState } from 'react';
import type { Song } from 'types';

import { NewSongStepper } from './New/NewSongStepper';
import { StepLyrics } from './New/StepLyrics';
import { StepVideoId } from './New/StepVideoId';

export type NewSong = Pick<
  Song,
  'videoId' | 'originalArtist' | 'title' | 'sectionIds' | 'content' | 'startAt' | 'endAt'
>;

export function NewSongPage() {
  const [step, setStep] = useState<number>(0);
  const [newSong, setNewSong] = useState<NewSong>({
    videoId: '',
    originalArtist: '',
    title: '',
    startAt: 0,
    endAt: 0,
    sectionIds: [],
    content: {},
  });

  const onUpdateNewSong = (data: Partial<NewSong>) => {
    setNewSong((prev) => ({ ...prev, ...data }));
  };

  return (
    <Content>
      <Typography.Title level={2}>Create Song</Typography.Title>

      <NewSongStepper step={step} />

      {step === 0 && <StepVideoId newSong={newSong} setStep={setStep} updateNewSong={onUpdateNewSong} />}

      {step === 1 && <StepLyrics newSong={newSong} setStep={setStep} updateNewSong={onUpdateNewSong} />}
    </Content>
  );
}
