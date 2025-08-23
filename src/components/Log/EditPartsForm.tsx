import { Button, Divider, Flex, Form, Popconfirm, Radio, Typography } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { Dictionary, Song, SongPart, UID, UpdateValue } from 'types';
import { distributor } from 'utils';
import { ASSIGNEES, DEFAULT_ASSIGNEE } from 'utils/constants';

const getInitialValue = (partsIds: string[], song: Song) => {
  const parts = partsIds.map((partId) => distributor.getPart(partId, song));

  const recommendedAssignee = parts[0].recommendedAssignee;
  return parts.every((part) => part.recommendedAssignee === recommendedAssignee) ? recommendedAssignee : '';
};

type EditPartsFormProps = {
  partsIds: UID[];
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditPartsForm({ partsIds, onClose, setDirty }: EditPartsFormProps) {
  const { song } = useSongEditContext();
  const { onBatchUpdateSong, onMovePartsTogether, onMergeParts } = useSongActions();

  const [groupedPart, setTempPart] = useState<Pick<SongPart, 'recommendedAssignee'>>({
    recommendedAssignee: getInitialValue(partsIds, song),
  });

  const [form] = Form.useForm<Partial<SongPart>>();
  const isDirty = form.isFieldsTouched();

  const onValuesChange = (changedValues: Partial<SongPart>) => {
    setTempPart({ ...groupedPart, ...changedValues });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: a function shouldn't be part of this dependency
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]);

  // Are all parts on the same line?
  const isSameLine = useMemo(() => {
    const base = distributor.getPartValue(partsIds[0], 'lineId', song, '');
    if (!base) return false;

    return partsIds.every((partId) => distributor.getPartValue(partId, 'lineId', song, '') === base);
  }, [partsIds, song]);

  const onSave = () => {
    const values = form.getFieldsValue();
    if (values.recommendedAssignee) {
      const updates = partsIds.reduce((acc: Dictionary<UpdateValue>, partId) => {
        Object.entries(values).forEach(([key, value]) => {
          acc[`content.${partId}.${key}`] = value;
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
      name="edit-part-form"
      initialValues={groupedPart}
      onValuesChange={onValuesChange}
      autoComplete="off"
      preserve={false}
      onFinish={onSave}
    >
      <Form.Item label="Batch change Recommended Assignee" name="recommendedAssignee">
        <Radio.Group optionType="button">
          {Object.values(ASSIGNEES).map((assignee) => (
            <Radio.Button
              key={assignee.value}
              value={assignee.value}
              disabled={assignee.value === DEFAULT_ASSIGNEE}
              style={{ backgroundColor: assignee.color }}
            >
              {assignee.label}
            </Radio.Button>
          ))}
        </Radio.Group>
      </Form.Item>

      <Form.Item>
        <Flex gap={6}>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" htmlType="submit" disabled={!isDirty} block>
            Save Changes
          </Button>
        </Flex>
      </Form.Item>

      <Divider />

      <Typography.Paragraph strong>Destructive Actions</Typography.Paragraph>

      <Form.Item help="All parts must be on the same line to merge.">
        <Popconfirm
          title="Are you sure you want to merge these parts?"
          onConfirm={() => {
            onMergeParts(partsIds);
            onClose();
          }}
        >
          <Button block icon={<i className="fi fi-rr-arrows-to-line" />} disabled={!isSameLine}>
            Merge parts into one part
          </Button>
        </Popconfirm>
      </Form.Item>

      <Form.Item help="At least one part must be on a different line">
        <Popconfirm
          title="Are you sure you want to move these parts to the same line?"
          onConfirm={() => onMovePartsTogether(partsIds)}
        >
          <Button block icon={<i className="fi fi-rr-arrows-to-dotted-line" />} disabled={isSameLine}>
            Move parts to the same line
          </Button>
        </Popconfirm>
      </Form.Item>
    </Form>
  );
}
