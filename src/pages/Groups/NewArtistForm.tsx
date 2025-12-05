import type { AggregationColor } from 'antd/es/color-picker/color';
import './NewArtistForm.scss';
import { Button, ColorPicker, Flex, Form, Input, Select, Slider } from 'antd';
import { useCreateArtistMutation } from 'hooks/useCreateArtistMutation';
import { useState } from 'react';
import type { Artist, Group } from 'types';
import { createArtist } from 'utils/groups';

type NewArtistFormFields = Pick<Artist, 'name' | 'track' | 'stats' | 'persona'> & {
  color: AggregationColor;
};

type NewArtistFormProps = {
  group: Group;
  onClose: () => void;
};

const options = [
  { value: 'VOCAL', label: 'Vocal' },
  { value: 'RAP', label: 'Rap' },
  { value: 'DANCE', label: 'Dance' },
];

export function NewArtistForm({ onClose, group }: NewArtistFormProps) {
  const { isPending, mutate: addArtist } = useCreateArtistMutation();

  const [form] = Form.useForm<NewArtistFormFields>();
  const [colorValue, setColorValue] = useState<string>('#FFFFFF');

  const onFinish = (values: NewArtistFormFields) => {
    const newArtist = createArtist(values.name, values.color.toHexString(), values.track, values.stats);

    const persona = values.persona?.trim();
    if (persona) {
      newArtist.persona = persona;
    }

    addArtist(
      {
        group,
        artist: newArtist,
      },
      {
        onSuccess: () => {
          form.resetFields();
          setColorValue('#FFFFFF');
          onClose();
        },
      },
    );
  };

  const onValuesChange = (changedValues: NewArtistFormFields) => {
    if (changedValues.color) {
      setColorValue(changedValues.color.toHexString());
    }
  };

  return (
    <Form
      autoComplete="off"
      form={form}
      layout="vertical"
      onFinish={onFinish}
      onValuesChange={onValuesChange}
      preserve={false}
    >
      <Form.Item label="Name" name="name" required>
        <Input />
      </Form.Item>

      <Form.Item label="Color" name="color" required>
        <ColorPicker
          defaultValue="#FFFFFF"
          disabledAlpha
          format="hex"
          showText={(color) => <span>{color.toHexString()}</span>}
        />
      </Form.Item>

      <Flex className="artist-form-colors" gap={6}>
        <span className="artist-form-color artist-form-color--black" style={{ backgroundColor: colorValue }}>
          Name
        </span>
        <span className="artist-form-color artist-form-color--white" style={{ backgroundColor: colorValue }}>
          Name
        </span>
        <span className="artist-form-color artist-form-color--bg-black" style={{ color: colorValue }}>
          Name
        </span>
        <span className="artist-form-color artist-form-color--bg-white" style={{ color: colorValue }}>
          Name
        </span>
      </Flex>

      <Form.Item label="Track" name="track" required>
        <Select options={options} />
      </Form.Item>

      <Form.Item label="Persona" name="persona">
        <Input.TextArea placeholder="Optional stage persona description" rows={2} />
      </Form.Item>

      <Flex gap={16}>
        <Flex style={{ flex: 1 }} vertical>
          <Form.Item initialValue={1} label="Vocals" name={['stats', 'vocals']}>
            <Slider marks={STATS_MARKS} max={5} min={1} />
          </Form.Item>

          <Form.Item initialValue={1} label="Rap" name={['stats', 'rap']}>
            <Slider marks={STATS_MARKS} max={5} min={1} />
          </Form.Item>

          <Form.Item initialValue={1} label="Dance" name={['stats', 'dance']}>
            <Slider marks={STATS_MARKS} max={5} min={1} />
          </Form.Item>
        </Flex>

        <Flex style={{ flex: 1 }} vertical>
          <Form.Item initialValue={1} label="Visual" name={['stats', 'visual']}>
            <Slider marks={STATS_MARKS} max={5} min={1} />
          </Form.Item>

          <Form.Item initialValue={1} label="Stage Presence" name={['stats', 'stagePresence']}>
            <Slider marks={STATS_MARKS} max={5} min={1} />
          </Form.Item>

          <Form.Item initialValue={1} label="Uniqueness" name={['stats', 'uniqueness']}>
            <Slider marks={STATS_MARKS} max={5} min={1} />
          </Form.Item>
        </Flex>
      </Flex>

      <Form.Item>
        <Button htmlType="submit" loading={isPending} type="primary">
          Add
        </Button>
      </Form.Item>
    </Form>
  );
}

const STATS_MARKS = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };
