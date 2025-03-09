import { App, Button, Checkbox, Divider, Form, Input, Space, TimePicker, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import YouTube from 'react-youtube';

import type { NewSong } from '../NewSongPage';
import { DURATION_FORMAT } from 'utils/constants';

type StepVideoIdProps = {
  newSong: NewSong;
  updateNewSong: (data: Partial<NewSong>) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
};

export function StepVideoId({ newSong, updateNewSong, setStep }: StepVideoIdProps) {
  const [videoIdInput, setVideoIdInput] = useState<string>('');
  const [form] = Form.useForm();

  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);
  const { notification } = App.useApp();

  const onParse = () => {
    if (videoIdInput.length > 5) {
      const extractedId = extractYouTubeVideoId(videoIdInput);
      if (extractedId) {
        updateNewSong({ videoId: extractedId });
      } else {
        notification.error({
          message: 'Failed to parse the video ID. Please try again.',
          placement: 'bottomRight',
          duration: 15,
        });
      }
    }
  };

  const onFormLayoutChange = (value: Partial<NewSong>) => {
    updateNewSong(value);
  };

  const onFinish = ({ startAt, endAt, ...values }: Partial<NewSong>) => {
    const dayjsStartAt = dayjs(startAt ?? 0, DURATION_FORMAT);
    const startAtInMs = (dayjsStartAt.minute() * 60 + dayjsStartAt.second()) * 1000;
    const dayjsEndAt = dayjs(endAt ?? 0, DURATION_FORMAT);
    const endAtInMs = (dayjsEndAt.minute() * 60 + dayjsEndAt.second()) * 1000;
    updateNewSong({ ...values, startAt: startAtInMs, endAt: endAtInMs });
    setStep((prev) => prev + 1);
  };

  return (
    <>
      <Typography.Paragraph>
        To create a new song, you need to provide a valid youtube video.
        <br />
        Paste any youtube link that contains a video id or the video id itself.
      </Typography.Paragraph>
      <Space>
        <Input
          placeholder="Enter a YouTube video ID"
          onChange={(e) => setVideoIdInput(e.target.value)}
          value={videoIdInput}
          onPressEnter={onParse}
        />
        <Button disabled={!videoIdInput || videoIdInput.length < 5} onClick={onParse}>
          Parse
        </Button>
      </Space>

      <Divider />

      {newSong.videoId && (
        <>
          <Typography.Text>Video ID: {newSong.videoId}</Typography.Text>
          <YouTube videoId={newSong.videoId} />

          <Divider />

          <Typography.Paragraph>
            <Checkbox onChange={(e) => setConfirmCheckbox(e.target.checked)} /> The video is displaying
            correctly and I would like to start the song creation process.
          </Typography.Paragraph>

          <Form
            form={form}
            initialValues={newSong}
            onValuesChange={onFormLayoutChange}
            layout="vertical"
            autoComplete="off"
            onFinish={onFinish}
          >
            <div className="grid grid-cols-2 gap-2 max-width-large">
              <Form.Item label="Song Title" name="title">
                <Input />
              </Form.Item>

              <Form.Item label="Original Artist" name="originalArtist">
                <Input />
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-2 max-width-large">
              <Form.Item label="Start At" name="startAt">
                <TimePicker
                  // defaultValue={dayjs('0:00', DURATION_FORMAT)}
                  format={DURATION_FORMAT}
                  showNow={false}
                />
              </Form.Item>

              <Form.Item label="End At" name="endAt">
                <TimePicker
                  // defaultValue={dayjs('0:00', DURATION_FORMAT)}
                  format={DURATION_FORMAT}
                  showNow={false}
                />
              </Form.Item>
            </div>

            <Form.Item>
              <Button
                size="large"
                type="primary"
                htmlType="submit"
                disabled={!confirmCheckbox || !newSong.title || !newSong.originalArtist || !newSong.endAt}
              >
                Next Step
              </Button>
            </Form.Item>
          </Form>
        </>
      )}
    </>
  );
}

function extractYouTubeVideoId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
    /^[^"&?/\s]{11}$/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}
