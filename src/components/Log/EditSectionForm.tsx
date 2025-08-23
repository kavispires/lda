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

  const onValuesChange = (changedValues: any) => {
    setTempSection({ ...tempSection, ...changedValues });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]);

  const onSave = () => {
    onUpdateSongContent(sectionId, tempSection);
    setDirty(false);
    onClose();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      name="edit-section-form"
      initialValues={tempSection}
      onValuesChange={onValuesChange}
      autoComplete="off"
      preserve={false}
      onFinish={onSave}
    >
      <Form.Item label="Kind" name="kind">
        <Select options={SECTION_SKILL_OPTIONS} />
      </Form.Item>

      <div className="grid grid-cols-2 gap-2">
        <Form.Item
          label="Number"
          name="number"
          help="This number is automatically generated when locking the song."
        >
          <Input type="number" disabled />
        </Form.Item>
        <Form.Item label="Lines count">
          <Input disabled value={tempSection.linesIds.length} />
        </Form.Item>
      </div>

      <Form.Item label="Lyric" help={`Collection of lyrics from all lines (${tempSection.linesIds.length}).`}>
        <Input.TextArea value={'...'} disabled autoSize={{ minRows: 1, maxRows: 6 }} />
      </Form.Item>

      <Divider className="my-4" />

      <Space size="small" direction="vertical" className="w-100">
        <Progress percent={getCompletionPercentage(Object.values(criteria))} className="w-100" />
        <CriteriaRule value={criteria.kind} label="Has kind" />
        <CriteriaRule value={criteria.linesIds} label="Has lines" />
      </Space>

      <Divider className="my-4" />

      <Form.Item label="" name="text" help="You can only delete a section without any lines">
        <Popconfirm
          title="Are you sure you want to delete this section?"
          onConfirm={() => onDeleteSection(sectionId)}
        >
          <Button
            type="primary"
            danger
            ghost
            icon={<DeleteOutlined />}
            block
            disabled={section.linesIds.length > 0}
          >
            Delete This Section
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
