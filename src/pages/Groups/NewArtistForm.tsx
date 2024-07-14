import './NewArtistForm.scss';

import { Button, ColorPicker, Flex, Form, Input, Select } from 'antd';
import { ColorFactory } from 'antd/es/color-picker/color';
import { useCreateArtistMutation } from 'hooks/useCreateArtistMutation';
import { useState } from 'react';
import { Artist, Group } from 'types';
import { createArtist } from 'utils/groups';

type NewArtistFormFields = Pick<Artist, 'name' | 'track'> & {
  color: ColorFactory;
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
    const newArtist = createArtist(values.name, values.color.toHexString(), values.track);
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
      }
    );
  };

  const onValuesChange = (changedValues: NewArtistFormFields) => {
    if (changedValues.color) {
      setColorValue(changedValues.color.toHexString());
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      autoComplete="off"
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
          format="hex"
          showText={(color) => <span>{color.toHexString()}</span>}
          disabledAlpha
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

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={isPending}>
          Add
        </Button>
      </Form.Item>
    </Form>
  );
}
