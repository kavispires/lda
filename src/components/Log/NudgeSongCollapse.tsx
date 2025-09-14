import { DoubleRightOutlined } from '@ant-design/icons';
import type { CollapseProps } from 'antd';
import { App, Button, Collapse, Divider, Flex, Form, Input, InputNumber, Switch, Typography } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import { useEffect, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { UID } from 'types';
import { distributor } from 'utils';

export function NudgeSongCollapse() {
  const [activePanel, setActivePanel] = useState<string[]>([]);
  const {
    selectionIdModel: { onDeselectAll },
  } = useSongEditContext();

  const items: CollapseProps['items'] = [
    {
      key: '1',
      label: 'Nudge Song',
      children: <div>{activePanel.includes('1') && <NudgeSongFlow setActivePanel={setActivePanel} />}</div>,
    },
  ];

  return (
    <Collapse
      items={items}
      size="small"
      activeKey={activePanel}
      expandIcon={({ isActive }) => <DoubleRightOutlined rotate={isActive ? 90 : 0} />}
      onChange={(keys) => {
        onDeselectAll();

        setActivePanel(keys);
      }}
    />
  );
}

type NudgeSongFlowProps = {
  setActivePanel: (panel: string[]) => void;
};

type NudgeFormValues = {
  fromLine: UID;
  milliseconds: number; // how much to nudge (can be negative)
  entireSong: boolean;
};

function NudgeSongFlow({ setActivePanel }: NudgeSongFlowProps) {
  const {
    song,
    selectionIdModel: { selection, onSelectOnly, onDeselectAll },
  } = useSongEditContext();
  const [form] = Form.useForm<NudgeFormValues>();
  const { message } = App.useApp();
  const { onNudgeSong } = useSongActions();

  // Watch form values for real-time validation
  const milliseconds = Form.useWatch('milliseconds', form) ?? 0;
  const fromLine = Form.useWatch('fromLine', form);
  const entireSong = Form.useWatch('entireSong', form) ?? false;

  const onSubmitNudge = (changedValues: NudgeFormValues) => {
    if (!Number.isInteger(changedValues.milliseconds)) {
      message.error('Nudge amount must be a whole number');
      return;
    }
    onNudgeSong(changedValues.milliseconds, changedValues.entireSong ? undefined : changedValues.fromLine);
    form.resetFields();
  };

  // Make sure that only a line is selected
  // biome-ignore lint/correctness/useExhaustiveDependencies: functions should not be dependencies
  useEffect(() => {
    if (selection.length > 1) {
      message.info('Auto-deselecting previous entities');
      onSelectOnly(selection[selection.length - 1]);
    }
    if (selection.length === 1) {
      const firstElement = selection[0];
      if (firstElement.startsWith('_s')) {
        // Find first line of section
        const section = distributor.getSection(firstElement, song);
        if (section) {
          message.info('Auto-selecting the first line of this section for the nudge');
          onSelectOnly(section.linesIds[0]);
        }
      }
      if (firstElement.startsWith('_p')) {
        // Find line the part belongs to
        const part = distributor.getPart(firstElement, song);
        if (part) {
          message.info('Auto-selecting the line the part belongs to for the nudge');
          onSelectOnly(part.lineId);
        }
      }
    }
  }, [song, selection]);

  useEffect(() => {
    form.setFieldsValue({
      fromLine: selection[0] || undefined,
    });
  }, [form, selection]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ignore functions
  useEffect(() => {
    if (entireSong) {
      form.setFieldsValue({
        fromLine: undefined,
      });
      onDeselectAll();
    }
  }, [entireSong]);

  return (
    <Form
      form={form}
      layout="vertical"
      name="edit-section-form"
      initialValues={{
        fromLine: selection[0] || undefined,
        milliseconds: 0,
        entireSong: false,
      }}
      autoComplete="off"
      preserve={false}
      onFinish={onSubmitNudge}
    >
      <Typography.Paragraph>
        You must click any line (or part or section) to be the start of the nudge, or select Entire song.
      </Typography.Paragraph>
      <Flex gap={8}>
        <Form.Item label="Nudge Amount" name="milliseconds" style={{ width: '35%' }}>
          <InputNumber min={-10000} max={10000} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="From Line" name="fromLine" style={{ width: '35%' }}>
          <Input readOnly />
        </Form.Item>

        <Form.Item
          label="Nudge Entire Song"
          name="entireSong"
          valuePropName="checked"
          style={{ width: '30%' }}
        >
          <Switch />
        </Form.Item>
      </Flex>

      <div>
        <Divider />
        <Flex justify="space-between" gap={12}>
          <Button type="default" onClick={() => setActivePanel([])}>
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            disabled={milliseconds === 0 || (!fromLine && !entireSong)}
            block
          >
            Perform Nudge
          </Button>
        </Flex>
      </div>
    </Form>
  );
}
