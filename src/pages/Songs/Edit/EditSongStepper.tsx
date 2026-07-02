import { useSongEditContext } from '@services/SongEditProvider';
import { Steps } from 'antd';

export function EditSongStepper() {
  const {
    stepper: { step, setStep },
  } = useSongEditContext();

  const onChange = (current: number) => {
    setStep(current);
  };

  return (
    <Steps
      className="mb-8"
      current={step}
      items={[
        {
          title: 'Sections',
        },
        {
          title: 'Sync',
        },
        {
          title: 'Preview',
        },
        {
          title: 'Metadata',
        },
      ]}
      onChange={onChange}
      size="small"
      type="navigation"
    />
  );
}
