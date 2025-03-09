import { Button, Flex, Form, Input, TimePicker, Typography } from 'antd';
import { useSongEditContext } from 'services/SongEditProvider';
import type { Song } from 'types';
import { DURATION_FORMAT } from 'utils/constants';
import dayjs from 'dayjs';
import { useState } from 'react';

export function StepMetadata() {
  const { song, updateSong } = useSongEditContext();

  const [form] = Form.useForm();
  const [temp, setTemp] = useState<Song>(song);

  const onFormLayoutChange = ({ startAt, endAt, ...otherValues }: Partial<Song>) => {
    const dayjsStartAt = dayjs(startAt ?? 0, DURATION_FORMAT);
    const startAtInMs = (dayjsStartAt.minute() * 60 + dayjsStartAt.second()) * 1000;
    const dayjsEndAt = dayjs(endAt ?? 0, DURATION_FORMAT);
    const endAtInMs = (dayjsEndAt.minute() * 60 + dayjsEndAt.second()) * 1000;

    setTemp((prev) => {
      const copy = { ...prev, ...otherValues };
      if (startAt) copy.startAt = startAtInMs;
      if (endAt) copy.endAt = endAtInMs;
      return copy;
    });
  };

  const onFinish = ({ startAt, endAt }: Partial<Song>) => {
    const dayjsStartAt = dayjs(startAt ?? 0, DURATION_FORMAT);
    const startAtInMs = (dayjsStartAt.minute() * 60 + dayjsStartAt.second()) * 1000;
    const dayjsEndAt = dayjs(endAt ?? 0, DURATION_FORMAT);
    const endAtInMs = (dayjsEndAt.minute() * 60 + dayjsEndAt.second()) * 1000;
    updateSong({ startAt: startAtInMs, endAt: endAtInMs });
  };
  // console.log(song.startAt);

  return (
    <div>
      <Form
        form={form}
        initialValues={song}
        onValuesChange={onFormLayoutChange}
        layout="vertical"
        autoComplete="off"
        onFinish={onFinish}
      >
        <div className="grid grid-cols-2 gap-2 max-width-large">
          <Form.Item label="Song Title" name="title">
            <Input disabled />
          </Form.Item>

          <Form.Item label="Original Artist" name="originalArtist">
            <Input disabled />
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-2 max-width-large">
          <Flex>
            <Form.Item label="Start At" name="startAt">
              <TimePicker
                // defaultValue={song.startAt ? formatMilliseconds(song.startAt) : null}
                format={DURATION_FORMAT}
                showNow={false}
              />
            </Form.Item>
            <Typography.Text code>{song.startAt}</Typography.Text>

            <Typography.Text code>{temp.startAt}</Typography.Text>
          </Flex>

          <Flex>
            <Form.Item label="End At" name="endAt">
              <TimePicker
                // defaultValue={song.endAt ? formatMilliseconds(song.endAt) : null}
                format={DURATION_FORMAT}
                showNow={false}
              />
            </Form.Item>
            <Typography.Text code>{song.endAt}</Typography.Text>

            <Typography.Text code>{temp.endAt}</Typography.Text>
          </Flex>
        </div>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            Update
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
