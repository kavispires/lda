import { Steps } from 'antd';
import { useSongEditContext } from 'services/SongEditProvider';

export function EditSongStepper() {
  const {
    stepper: { step, setStep },
  } = useSongEditContext();

  const onChange = (current: number) => {
    setStep(current);
  };

  return (
    <Steps
      current={step}
      size="small"
      onChange={onChange}
      type="navigation"
      className="mb-8"
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
    />
  );
}
