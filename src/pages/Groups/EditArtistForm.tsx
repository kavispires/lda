import type { AggregationColor } from 'antd/es/color-picker/color';
import './NewArtistForm.scss';

import { Button, ColorPicker, Flex, Form, Input, Select, Slider } from 'antd';

import { useUpdateArtistMutation } from 'hooks/useUpdateArtistMutation';
import { useEffect, useState } from 'react';
import type { Artist, Group } from 'types';

type EditArtistFormFields = Pick<Artist, 'name' | 'track' | 'stats' | 'persona'> & {
  color: AggregationColor;
};

type EditArtistFormProps = {
  artist: Artist;
  group: Group;
  onClose: () => void;
};

const options = [
  { value: 'VOCAL', label: 'Vocal' },
  { value: 'RAP', label: 'Rap' },
  { value: 'DANCE', label: 'Dance' },
];

export function EditArtistForm({ onClose, artist, group }: EditArtistFormProps) {
  const { isPending, mutate: updateArtist } = useUpdateArtistMutation();

  const [form] = Form.useForm<EditArtistFormFields>();
  const [colorValue, setColorValue] = useState<string>(artist.color);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  useEffect(() => {
    form.setFieldsValue({
      name: artist.name,
      track: artist.track,
      color: artist.color as unknown as AggregationColor,
      persona: artist.persona,
      stats: artist.stats || {
        vocals: 1,
        rap: 1,
        dance: 1,
        visual: 1,
        stagePresence: 1,
        uniqueness: 1,
      },
    });
  }, [artist, form]);

  const checkForChanges = (values: Partial<EditArtistFormFields>) => {
    const colorHex = typeof values.color === 'string' ? values.color : values?.color?.toHexString();
    const changed =
      values.name !== artist.name ||
      colorHex !== artist.color ||
      values.track !== artist.track ||
      (values.persona?.trim() || undefined) !== artist.persona ||
      values.stats?.vocals !== (artist.stats?.vocals || 1) ||
      values.stats?.rap !== (artist.stats?.rap || 1) ||
      values.stats?.dance !== (artist.stats?.dance || 1) ||
      values.stats?.visual !== (artist.stats?.visual || 1) ||
      values.stats?.stagePresence !== (artist.stats?.stagePresence || 1) ||
      values.stats?.uniqueness !== (artist.stats?.uniqueness || 1);
    setHasChanges(changed);
  };

  const onFinish = (values: EditArtistFormFields) => {
    const updatedArtist: Artist = {
      ...artist,
      name: values.name,
      color: String(values.color).startsWith('#') ? String(values.color) : values.color.toHexString(),
      track: values.track,
      stats: values.stats,
    };

    const persona = values.persona?.trim();
    if (persona) {
      updatedArtist.persona = persona;
    }

    updateArtist(
      {
        artist: updatedArtist,
        groupName: group.name,
      },
      {
        onSuccess: () => {
          setHasChanges(false);
          onClose();
        },
      },
    );
  };

  const onValuesChange = (changedValues: Partial<EditArtistFormFields>, allValues: EditArtistFormFields) => {
    if (changedValues.color) {
      setColorValue(changedValues.color.toHexString());
    }
    checkForChanges(allValues);
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
        <ColorPicker disabledAlpha format="hex" showText={(color) => <span>{color.toHexString()}</span>} />
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
        <Button disabled={!hasChanges} htmlType="submit" loading={isPending} type="primary">
          Update
        </Button>
      </Form.Item>
    </Form>
  );
}

const STATS_MARKS = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };
