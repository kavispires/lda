import { Steps } from 'antd';

type NewSongStepperProps = {
  step: number;
};

export function NewSongStepper({ step }: NewSongStepperProps) {
  return (
    <Steps
      current={step}
      size="small"
      className="mb-8"
      items={[
        {
          title: 'Video ID',
        },
        {
          title: 'Lyrics',
        },
        {
          title: '...',
        },
      ]}
    />
  );
}
