import { Button, Divider, Flex, Form, Input, Popconfirm, Progress, Select, Space } from 'antd';
import { useLogSection } from 'hooks/useLogInstances';
import { useSongActions } from 'hooks/useSongActions';
import React, { useEffect, useState } from 'react';
import { SongSection, UID } from 'types';
import { getCompletionPercentage } from 'utils';
import { NULL, SECTION_KINDS } from 'utils/constants';

import { DeleteOutlined } from '@ant-design/icons';

import { CriteriaRule } from './CriteriaRule';

const SECTION_SKILL_OPTIONS = Object.values(SECTION_KINDS).map((skill) => ({ label: skill, value: skill }));

type EditSectionFormProps = {
  sectionId: UID;
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditSectionForm({ sectionId, onClose, setDirty }: EditSectionFormProps) {
  const { section } = useLogSection(sectionId);
  const { onUpdateSongContent } = useSongActions();
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

  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <Input.TextArea value={'text'} disabled autoSize={{ minRows: 1, maxRows: 6 }} />
      </Form.Item>

      <Divider className="my-4" />

      <Space size="small" direction="vertical" className="w-100">
        <Progress percent={getCompletionPercentage(Object.values(criteria))} className="w-100" />
        <CriteriaRule value={criteria.kind} label="Has kind" />
        <CriteriaRule value={criteria.linesIds} label="Has lines" />
      </Space>

      <Divider className="my-4" />

      <Form.Item label="" name="text" help="You can only delete a section with not lines">
        <Popconfirm title="Are you sure you want to delete this section?" onConfirm={() => {}}>
          <Button type="primary" danger icon={<DeleteOutlined />} block disabled>
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
