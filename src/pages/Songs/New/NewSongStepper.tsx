import { Steps } from 'antd';

type NewSongStepperProps = {
  step: number;
};

export function NewSongStepper({ step }: NewSongStepperProps) {
  return (
    <Steps
      className="mb-8"
      current={step}
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
      size="small"
      type="navigation"
    />
  );
}
