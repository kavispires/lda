import { DeleteOutlined, LogoutOutlined } from '@ant-design/icons';
import {
  Button,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Progress,
  Radio,
  Select,
  Space,
} from 'antd';
import { useLogPart } from 'hooks/useLogInstances';
import { useSongActions } from 'hooks/useSongActions';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { SongPart, UID } from 'types';
import { distributor, getCompletionPercentage } from 'utils';
import { ASSIGNEES, DEFAULT_ASSIGNEE } from 'utils/constants';

import { CriteriaRule } from './CriteriaRule';

type EditPartFormProps = {
  partId: UID;
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditPartForm({ partId, onClose, setDirty }: EditPartFormProps) {
  const { song } = useSongEditContext();

  const { part } = useLogPart(partId, song);
  const { onUpdateSongContent, onDeletePart, onConvertPartToNewLine } = useSongActions();
  const [tempPart, setTempPart] = useState<SongPart>(part);
  const [showMoveFlow, setShowMoveFlow] = useState(false);

  const [form] = Form.useForm<SongPart>();
  const isDirty = form.isFieldsTouched();

  const criteria = {
    lyric: Boolean(tempPart.text.trim()),
    duration: tempPart.endTime > tempPart.startTime,
    lineId: Boolean(tempPart.lineId),
    assignee: tempPart.recommendedAssignee !== DEFAULT_ASSIGNEE,
  };

  const onValuesChange = (changedValues: Partial<SongPart>) => {
    setTempPart({ ...tempPart, ...changedValues });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: on purpose
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]);

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
            <Button type="link" size="small" onClick={() => setShowMoveFlow((prev) => !prev)} disabled>
              Move
            </Button>
          }
        >
          <Input disabled />
        </Form.Item>
      </div>

      {showMoveFlow && <MovePartFlow partId={partId} />}

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
        <Popconfirm title="Are you sure you want to delete this part?" onConfirm={() => onDeletePart(partId)}>
          <Button type="primary" danger icon={<DeleteOutlined />} block ghost>
            Delete This Part
          </Button>
        </Popconfirm>
      </Form.Item>

      <Form.Item label="" help="Move this part to a new line keeping its content.">
        <Popconfirm
          title="Are you sure you want to convert this part to a new line?"
          onConfirm={() => onConvertPartToNewLine(partId)}
        >
          <Button type="primary" icon={<LogoutOutlined />} block ghost>
            Convert to New Line
          </Button>
        </Popconfirm>
      </Form.Item>

      <Divider />
      <Form.Item>
        <Flex gap={6}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" disabled={!isDirty} block>
            Save Changes
          </Button>
        </Flex>
      </Form.Item>
    </Form>
  );
}

type MovePartFlowProps = {
  partId: UID;
};

function MovePartFlow({ partId }: MovePartFlowProps) {
  const { song } = useSongEditContext();
  const { onMovePart } = useSongActions();
  const [targetLineId, setTargetLineId] = useState('');

  const typeahead = useMemo(() => {
    return distributor.getLinesTypeahead(song);
  }, [song]);

  const onMove = () => {
    onMovePart(partId, targetLineId);
  };

  return (
    <div className="bordered p-2">
      <Form.Item label="Choose Destination Line" className="w-100">
        <Select options={typeahead} onChange={(e) => setTargetLineId(e)} />
      </Form.Item>

      <Button disabled={!targetLineId} onClick={onMove}>
        Move to {targetLineId}
      </Button>
    </div>
  );
}
