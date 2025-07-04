import { DeleteOutlined } from '@ant-design/icons';
import { Button, Divider, Flex, Form, Input, Popconfirm, Progress, Rate, Select, Space, Switch } from 'antd';
import { useLogLine } from 'hooks/useLogInstances';
import { useSongActions } from 'hooks/useSongActions';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { SongLine, UID } from 'types';
import { getCompletionPercentage } from 'utils';
import { LINE_SKILL } from 'utils/constants';

import { CriteriaRule } from './CriteriaRule';

const LINE_SKILL_OPTIONS = Object.values(LINE_SKILL).map((skill) => ({ label: skill, value: skill }));

type EditLineFormProps = {
  lineId: UID;
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditLineForm({ lineId, onClose, setDirty }: EditLineFormProps) {
  const { song } = useSongEditContext();
  const { line, text } = useLogLine(lineId, song);
  const { onUpdateSongContent, onDeleteLine } = useSongActions();
  const [tempLine, setTempLine] = useState<SongLine>(line);

  const [form] = Form.useForm<SongLine>();
  const isDirty = form.isFieldsTouched();

  const criteria = {
    sectionId: Boolean(tempLine.sectionId),
    partsIds: tempLine.partsIds.length > 0,
  };

  const onValuesChange = (changedValues: any) => {
    setTempLine({ ...tempLine, ...changedValues });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: idk
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]);

  const onSave = () => {
    onUpdateSongContent(lineId, tempLine);
    setDirty(false);
    onClose();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      name="edit-line-form"
      initialValues={tempLine}
      onValuesChange={onValuesChange}
      autoComplete="off"
      preserve={false}
      onFinish={onSave}
    >
      <div className="grid grid-cols-3 gap-2">
        <Form.Item label="Skill" name="skill.type">
          <Select options={LINE_SKILL_OPTIONS} />
        </Form.Item>
        <Form.Item label="Level" name="skill.level">
          <Rate count={3} />
        </Form.Item>
        <Form.Item label="Section Id" name="sectionId">
          <Input disabled />
        </Form.Item>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Form.Item
          label="Adlib"
          name="adlib"
          valuePropName="checked"
          help="Check if line is an adlib not in the flow of the song."
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Dismissible"
          name="dismissible"
          valuePropName="checked"
          help="Check if line does not need to be displayed (vocalizing or effects)."
        >
          <Switch />
        </Form.Item>
      </div>

      <Form.Item label="Lyric" help={`Collection of lyrics from all parts (${tempLine.partsIds.length}).`}>
        <Input value={text} disabled />
      </Form.Item>

      <div className="grid grid-cols-3 gap-2"></div>

      <Divider className="my-4" />

      <Space size="small" direction="vertical" className="w-100">
        <Progress percent={getCompletionPercentage(Object.values(criteria))} className="w-100" />
        <CriteriaRule value={criteria.sectionId} label="Has sectionId" />
        <CriteriaRule value={criteria.partsIds} label="Has parts" />
      </Space>
      <Divider className="my-4" />

      <div className="my-4">TODO: Nudge line</div>

      <Form.Item label="" name="text" help="You can only delete a line with no parts">
        <Popconfirm title="Are you sure you want to delete this line?" onConfirm={() => onDeleteLine(lineId)}>
          <Button
            type="primary"
            danger
            ghost
            icon={<DeleteOutlined />}
            block
            disabled={line.partsIds.length > 0}
          >
            Delete This Line
          </Button>
        </Popconfirm>
      </Form.Item>

      <Divider />
      <Form.Item>
        <Flex gap={6}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" disabled={!form.isFieldsTouched()} block>
            Save Changes
          </Button>
        </Flex>
      </Form.Item>
    </Form>
  );
}
