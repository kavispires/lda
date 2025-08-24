import { Button, Divider, Flex, Form, Popconfirm, Select, Typography } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { Dictionary, Song, SongSection, UID, UpdateValue } from 'types';
import { distributor } from 'utils';
import { SECTION_KINDS } from 'utils/constants';

const getInitialValue = (sectionIds: string[], song: Song) => {
  const sections = sectionIds.map((sectionId) => distributor.getSection(sectionId, song));

  const kinds = sections[0].kind;
  return sections.every((section) => section.kind === kinds) ? kinds : '';
};

const SECTION_SKILL_OPTIONS = Object.values(SECTION_KINDS).map((skill) => ({ label: skill, value: skill }));

type EditSectionsFormProps = {
  sectionsIds: UID[];
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditSectionsForm({ sectionsIds, onClose, setDirty }: EditSectionsFormProps) {
  const { song } = useSongEditContext();
  const { onBatchUpdateSong, onMergeSections } = useSongActions();
  const [groupedSection, setTempSection] = useState<Pick<SongSection, 'kind'>>({
    kind: getInitialValue(sectionsIds, song),
  });

  const [form] = Form.useForm<Partial<SongSection>>();
  const isDirty = form.isFieldsTouched();

  const onValuesChange = (changedValues: Partial<SongSection>) => {
    setTempSection({ ...groupedSection, ...changedValues });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: a function shouldn't be part of this dependency
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]);

  const onSave = () => {
    const values = form.getFieldsValue();
    if (values.kind) {
      const updates = sectionsIds.reduce((acc: Dictionary<UpdateValue>, sectionId) => {
        Object.entries(values).forEach(([key, value]) => {
          acc[`content.${sectionId}.${key}`] = value;
        });
        return acc;
      }, {});
      onBatchUpdateSong(updates);
      setDirty(false);
      onClose();
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      name="edit-section-form"
      initialValues={groupedSection}
      onValuesChange={onValuesChange}
      autoComplete="off"
      preserve={false}
      onFinish={onSave}
    >
      <Form.Item label="Kind" name="kind">
        <Select options={SECTION_SKILL_OPTIONS} />
      </Form.Item>

      <Form.Item>
        <Flex gap={6}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" disabled={!form.isFieldsTouched()} block>
            Save Changes
          </Button>
        </Flex>
      </Form.Item>

      <Divider />

      <Typography.Paragraph strong>Destructive Actions</Typography.Paragraph>

      <Form.Item>
        <Popconfirm
          title="Are you sure you want to merge these sections?"
          onConfirm={() => {
            onMergeSections(sectionsIds);
            onClose();
          }}
        >
          <Button block icon={<i className="fi fi-rr-arrows-to-line" />}>
            Merge sections into one section
          </Button>
        </Popconfirm>
      </Form.Item>
    </Form>
  );
}
