import { DeleteOutlined } from '@ant-design/icons';
import { Button, Divider, Flex, Form, Input, Popconfirm, Progress, Select, Space } from 'antd';
import { useLogSection } from 'hooks/useLogInstances';
import { useSongActions } from 'hooks/useSongActions';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { SongSection, UID } from 'types';
import { getCompletionPercentage } from 'utils';
import { NULL, SECTION_KINDS } from 'utils/constants';

import { CriteriaRule } from './CriteriaRule';

const SECTION_SKILL_OPTIONS = Object.values(SECTION_KINDS).map((skill) => ({ label: skill, value: skill }));

type EditSectionFormProps = {
  sectionId: UID;
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditSectionForm({ sectionId, onClose, setDirty }: EditSectionFormProps) {
  const { song } = useSongEditContext();
  const { section } = useLogSection(sectionId, song);
  const { onUpdateSongContent, onDeleteSection } = useSongActions();
  const [tempSection, setTempSection] = useState<SongSection>(section);

  const [form] = Form.useForm<SongSection>();
  const isDirty = form.isFieldsTouched();

  const criteria = {
    kind: tempSection.kind !== NULL,
    linesIds: tempSection.linesIds.length > 0,
  };

  const onValuesChange = (changedValues: Partial<SongSection>) => {
    setTempSection({ ...tempSection, ...changedValues });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies:a function shouldn't be part of this dependency
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]);

  const onApplyChanges = () => {
    onUpdateSongContent(sectionId, tempSection);
    setDirty(false);
    onClose();
  };

  return (
    <Form
      autoComplete="off"
      form={form}
      initialValues={tempSection}
      layout="vertical"
      name="edit-section-form"
      onFinish={onApplyChanges}
      onValuesChange={onValuesChange}
      preserve={false}
    >
      <Form.Item label="Kind" name="kind">
        <Select options={SECTION_SKILL_OPTIONS} />
      </Form.Item>

      <div className="grid grid-cols-2 gap-2">
        <Form.Item
          help="This number is automatically generated when locking the song."
          label="Number"
          name="number"
        >
          <Input disabled type="number" />
        </Form.Item>
        <Form.Item label="Lines count">
          <Input disabled value={tempSection.linesIds.length} />
        </Form.Item>
      </div>

      <Form.Item help={`Collection of lyrics from all lines (${tempSection.linesIds.length}).`} label="Lyric">
        <Input.TextArea autoSize={{ minRows: 1, maxRows: 6 }} disabled value={'...'} />
      </Form.Item>

      <Divider className="my-4" />

      <Space className="w-100" direction="vertical" size="small">
        <Progress className="w-100" percent={getCompletionPercentage(Object.values(criteria))} />
        <CriteriaRule label="Has kind" value={criteria.kind} />
        <CriteriaRule label="Has lines" value={criteria.linesIds} />
      </Space>

      <Divider className="my-4" />

      <Form.Item help="You can only delete a section without any lines" label="" name="text">
        <Popconfirm
          onConfirm={() => onDeleteSection(sectionId)}
          title="Are you sure you want to delete this section?"
        >
          <Button
            block
            danger
            disabled={section.linesIds.length > 0}
            ghost
            icon={<DeleteOutlined />}
            type="primary"
          >
            Delete This Section
          </Button>
        </Popconfirm>
      </Form.Item>

      <Divider />
      <Form.Item>
        <Flex gap={6}>
          <Button onClick={onClose}>Cancel</Button>
          <Button block disabled={!form.isFieldsTouched()} htmlType="submit" type="primary">
            Apply Changes
          </Button>
        </Flex>
      </Form.Item>
    </Form>
  );
}
