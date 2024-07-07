import { Button, Divider, Flex, Form, Input, InputNumber, Popconfirm, Progress, Radio, Space } from 'antd';
import { useLogPart } from 'hooks/useLogInstances';
import { useSongActions } from 'hooks/useSongActions';
import React, { useEffect, useState } from 'react';
import { SongPart, UID } from 'types';
import { getCompletionPercentage } from 'utils';
import { ASSIGNEES, DEFAULT_ASSIGNEE } from 'utils/constants';

import { DeleteOutlined } from '@ant-design/icons';

import { CriteriaRule } from './CriteriaRule';

type EditPartFormProps = {
  partId: UID;
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditPartForm({ partId, onClose, setDirty }: EditPartFormProps) {
  const { part } = useLogPart(partId);
  const { onUpdateSongContent } = useSongActions();
  const [tempPart, setTempPart] = useState<SongPart>(part);

  const [form] = Form.useForm<SongPart>();

  const criteria = {
    lyric: Boolean(tempPart.text.trim()),
    duration: tempPart.endTime > tempPart.startTime,
    lineId: Boolean(tempPart.lineId),
    assignee: tempPart.recommendedAssignee !== DEFAULT_ASSIGNEE,
  };

  const onValuesChange = (changedValues: Partial<SongPart>) => {
    setTempPart({ ...tempPart, ...changedValues });
  };

  useEffect(() => {
    setDirty(form.isFieldsTouched());
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = () => {
    onUpdateSongContent(partId, tempPart);
    setDirty(false);
    onClose();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      name="edit-part-form"
      initialValues={tempPart}
      onValuesChange={onValuesChange}
      autoComplete="off"
      preserve={false}
      onFinish={onSave}
    >
      <Form.Item label="Recommended Assignee" name="recommendedAssignee">
        <Radio.Group optionType="button">
          {Object.values(ASSIGNEES).map((assignee) => (
            <Radio.Button
              key={assignee.value}
              value={assignee.value}
              style={{ backgroundColor: assignee.color }}
              disabled={assignee.value === DEFAULT_ASSIGNEE}
            >
              {assignee.label}
            </Radio.Button>
          ))}
        </Radio.Group>
      </Form.Item>

      <Form.Item label="Lyric" name="text">
        <Input />
      </Form.Item>

      <div className="grid grid-cols-3">
        <Form.Item label="Start Time" name="startTime" help="In ms">
          <InputNumber />
        </Form.Item>

        <Form.Item label="End Time" name="endTime" help="In ms">
          <InputNumber />
        </Form.Item>

        <Form.Item
          label="Line Id"
          name="lineId"
          help={
            <Button type="link" size="small" disabled>
              Move
            </Button>
          }
        >
          <Input disabled />
        </Form.Item>
      </div>

      <Divider className="my-4" />

      <Space size="small" direction="vertical" className="w-100">
        <Progress percent={getCompletionPercentage(Object.values(criteria))} className="w-100" />
        <CriteriaRule value={criteria.lyric} label="Has lyric" />
        <CriteriaRule value={criteria.duration} label="Has duration" />
        <CriteriaRule value={criteria.lineId} label="Has lineId" />
        <CriteriaRule value={criteria.assignee} label="Has proper assignee" />
      </Space>

      <Divider className="my-4" />

      <Form.Item label="" help="Permanently delete this entire part.">
        <Popconfirm title="Are you sure you want to delete this part?" onConfirm={() => {}}>
          <Button type="primary" danger icon={<DeleteOutlined />} block disabled>
            Delete This Part
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
