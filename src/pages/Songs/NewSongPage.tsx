import { Typography } from 'antd';
import { useState } from 'react';
import { NewSongStepper } from './New/NewSongStepper';
import { StepOne } from './New/StepOne';
import { Song } from 'types';
import { StepTwo } from './New/StepTwo';
import './NewSongPage.scss';

export type NewSong = Pick<
  Song,
  'videoId' | 'originalArtist' | 'title' | 'duration' | 'sectionIds' | 'content'
>;

export function NewSongPage() {
  const [step, setStep] = useState<number>(0);
  const [newSong, setNewSong] = useState<NewSong>({
    videoId: '',
    originalArtist: '',
    title: '',
    duration: 0,
    sectionIds: [],
    content: {},
  });

  const onUpdateNewSong = (data: Partial<NewSong>) => {
    setNewSong((prev) => ({ ...prev, ...data }));
  };

  return (
    <div className="m-4">
      <Typography.Title level={2}>Create Song</Typography.Title>

      <NewSongStepper step={step} />

      {step === 0 && <StepOne newSong={newSong} updateNewSong={onUpdateNewSong} setStep={setStep} />}

      {step === 1 && <StepTwo newSong={newSong} updateNewSong={onUpdateNewSong} setStep={setStep} />}
    </div>
  );
}
