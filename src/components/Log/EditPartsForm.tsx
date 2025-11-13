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

  const onApplyChanges = () => {
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
      autoComplete="off"
      form={form}
      initialValues={groupedPart}
      layout="vertical"
      name="edit-part-form"
      onFinish={onApplyChanges}
      onValuesChange={onValuesChange}
      preserve={false}
    >
      <Form.Item label="Batch change Recommended Assignee" name="recommendedAssignee">
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

      <Form.Item>
        <Flex gap={6}>
          <Button onClick={onClose}>Close</Button>
          <Button block disabled={!isDirty} htmlType="submit" type="primary">
            Apply Changes
          </Button>
        </Flex>
      </Form.Item>

      <Divider />

      <Typography.Paragraph strong>Destructive Actions</Typography.Paragraph>

      <Form.Item help="All parts must be on the same line to merge.">
        <Popconfirm
          onConfirm={() => {
            onMergeParts(partsIds);
            onClose();
          }}
          title="Are you sure you want to merge these parts?"
        >
          <Button block disabled={!isSameLine} icon={<i className="fi fi-rr-arrows-to-line" />}>
            Merge parts into one part
          </Button>
        </Popconfirm>
      </Form.Item>

      <Form.Item help="At least one part must be on a different line">
        <Popconfirm
          onConfirm={() => onMovePartsTogether(partsIds)}
          title="Are you sure you want to move these parts to the same line?"
        >
          <Button block disabled={isSameLine} icon={<i className="fi fi-rr-arrows-to-dotted-line" />}>
            Move parts to the same line
          </Button>
        </Popconfirm>
      </Form.Item>
    </Form>
  );
}
