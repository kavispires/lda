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

  const onApplyChanges = () => {
    onUpdateSongContent(partId, tempPart);
    setDirty(false);
    onClose();
  };

  return (
    <Form
      autoComplete="off"
      form={form}
      initialValues={tempPart}
      layout="vertical"
      name="edit-part-form"
      onFinish={onApplyChanges}
      onValuesChange={onValuesChange}
      preserve={false}
    >
      <Form.Item label="Recommended Assignee" name="recommendedAssignee">
        <Radio.Group optionType="button">
          {Object.values(ASSIGNEES).map((assignee) => (
            <Radio.Button
              disabled={assignee.value === DEFAULT_ASSIGNEE}
              key={assignee.value}
              style={{ backgroundColor: assignee.color }}
              value={assignee.value}
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
        <Form.Item help="In ms" label="Start Time" name="startTime">
          <InputNumber />
        </Form.Item>

        <Form.Item help="In ms" label="End Time" name="endTime">
          <InputNumber />
        </Form.Item>

        <Form.Item
          help={
            <Button disabled onClick={() => setShowMoveFlow((prev) => !prev)} size="small" type="link">
              Move
            </Button>
          }
          label="Line Id"
          name="lineId"
        >
          <Input disabled />
        </Form.Item>
      </div>

      {showMoveFlow && <MovePartFlow partId={partId} />}

      <Divider className="my-4" />

      <Space className="w-100" direction="vertical" size="small">
        <Progress className="w-100" percent={getCompletionPercentage(Object.values(criteria))} />
        <CriteriaRule label="Has lyric" value={criteria.lyric} />
        <CriteriaRule label="Has duration" value={criteria.duration} />
        <CriteriaRule label="Has lineId" value={criteria.lineId} />
        <CriteriaRule label="Has proper assignee" value={criteria.assignee} />
      </Space>

      <Divider className="my-4" />

      <Form.Item help="Permanently delete this entire part." label="">
        <Popconfirm onConfirm={() => onDeletePart(partId)} title="Are you sure you want to delete this part?">
          <Button block danger ghost icon={<DeleteOutlined />} type="primary">
            Delete This Part
          </Button>
        </Popconfirm>
      </Form.Item>

      <Form.Item help="Move this part to a new line keeping its content." label="">
        <Popconfirm
          onConfirm={() => onConvertPartToNewLine(partId)}
          title="Are you sure you want to convert this part to a new line?"
        >
          <Button block ghost icon={<LogoutOutlined />} type="primary">
            Convert to New Line
          </Button>
        </Popconfirm>
      </Form.Item>

      <Divider />
      <Form.Item>
        <Flex gap={6}>
          <Button onClick={onClose}>Cancel</Button>
          <Button block disabled={!isDirty} htmlType="submit" type="primary">
            Apply Changes
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
  const { onMovePartToLine } = useSongActions();
  const [targetLineId, setTargetLineId] = useState('');

  const typeahead = useMemo(() => {
    return distributor.getLinesTypeahead(song);
  }, [song]);

  const onMove = () => {
    onMovePartToLine(partId, targetLineId);
  };

  return (
    <div className="bordered p-2">
      <Form.Item className="w-100" label="Choose Destination Line">
        <Select onChange={(e) => setTargetLineId(e)} options={typeahead} />
      </Form.Item>

      <Button disabled={!targetLineId} onClick={onMove}>
        Move to {targetLineId}
      </Button>
    </div>
  );
}
