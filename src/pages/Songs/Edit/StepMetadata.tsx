import { Button, Flex, Form, Input, TimePicker, Typography } from 'antd';
import { PlaybackVideo } from 'components/Video/PlaybackVideo';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useMeasure } from 'react-use';
import { useSongEditContext } from 'services/SongEditProvider';
import type { Song } from 'types';
import { DURATION_FORMAT } from 'utils/constants';

// Convert milliseconds to dayjs object for TimePicker
const millisecondsToTimePicker = (ms: number) => {
  if (!ms) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return dayjs().hour(0).minute(minutes).second(seconds);
};

export function StepMetadata() {
  const { song, updateSong } = useSongEditContext();

  const [form] = Form.useForm();
  const [temp, setTemp] = useState<Song>(song);

  const onFormLayoutChange = ({ startAt, endAt, ...otherValues }: Partial<Song>) => {
    // Check if startAt or endAt are dayjs objects from TimePicker
    const dayjsStartAt = startAt ? dayjs(startAt) : null;
    const dayjsEndAt = endAt ? dayjs(endAt) : null;

    // Convert to milliseconds if they are dayjs objects
    const startAtInMs = dayjsStartAt
      ? (dayjsStartAt.minute() * 60 + dayjsStartAt.second()) * 1000
      : undefined;
    const endAtInMs = dayjsEndAt ? (dayjsEndAt.minute() * 60 + dayjsEndAt.second()) * 1000 : undefined;

    setTemp((prev) => {
      const copy = { ...prev, ...otherValues };
      if (startAtInMs !== undefined) copy.startAt = startAtInMs;
      if (endAtInMs !== undefined) copy.endAt = endAtInMs;
      return copy;
    });
  };

  const onFinish = ({ startAt, endAt, ...otherValues }: Partial<Song>) => {
    // Check if startAt or endAt are dayjs objects from TimePicker
    const dayjsStartAt = startAt ? dayjs(startAt) : null;
    const dayjsEndAt = endAt ? dayjs(endAt) : null;

    // Convert to milliseconds if they are dayjs objects
    const startAtInMs = dayjsStartAt
      ? (dayjsStartAt.minute() * 60 + dayjsStartAt.second()) * 1000
      : song.startAt;
    const endAtInMs = dayjsEndAt ? (dayjsEndAt.minute() * 60 + dayjsEndAt.second()) * 1000 : song.endAt;

    updateSong({ ...otherValues, startAt: startAtInMs, endAt: endAtInMs });
  };

  const videoId = Form.useWatch('videoId', form);
  const videoHasChanged = videoId !== song.videoId;
  const [ref, { width }] = useMeasure<HTMLElement>();

  return (
    <Flex vertical ref={ref}>
      <Form
        form={form}
        initialValues={{
          ...song,
          startAt: millisecondsToTimePicker(song.startAt),
          endAt: millisecondsToTimePicker(song.endAt),
        }}
        onValuesChange={onFormLayoutChange}
        layout="vertical"
        autoComplete="off"
        onFinish={onFinish}
      >
        <div className="grid grid-cols-4 gap-2">
          <Form.Item label="Youtube Video Id" name="videoId" help="This action is very destructive">
            <Input size="large" />
          </Form.Item>

          <Form.Item label="Song Title" name="title">
            <Input disabled size="large" />
          </Form.Item>

          <Form.Item label="Original Artist" name="originalArtist">
            <Input disabled size="large" />
          </Form.Item>

          <Form.Item key={videoId}>
            {videoHasChanged && <PlaybackVideo videoId={videoId} width={Math.min(width / 5, 480)} />}
          </Form.Item>
        </div>

        <div className="grid grid-cols-4 gap-2 max-width-large my-4">
          <Flex>
            <Form.Item label="Start At" name="startAt">
              <TimePicker format={DURATION_FORMAT} showNow={false} />
            </Form.Item>

            <Typography.Text code>{temp.startAt}</Typography.Text>
          </Flex>

          <Flex>
            <Form.Item label="End At" name="endAt">
              <TimePicker format={DURATION_FORMAT} showNow={false} />
            </Form.Item>

            <Typography.Text code>{temp.endAt}</Typography.Text>
          </Flex>
        </div>

        <Flex gap={12}>
          <Form.Item>
            <Button type="default" htmlType="reset">
              Reset Form
            </Button>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Update
            </Button>
          </Form.Item>
        </Flex>
      </Form>
    </Flex>
  );
}
