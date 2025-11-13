import { Button, Divider, Flex, Form, Input, Popconfirm, Rate, Select, Switch, Typography } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { Dictionary, Song, SongLine, UID, UpdateValue } from 'types';
import { distributor } from 'utils';
import { LINE_SKILL } from 'utils/constants';
import { MoveLinesToSectionSelector } from './MoveLinesToSectionSelector';

type CommonLineProps = Pick<SongLine, 'skill' | 'adlib' | 'dismissible'>;

const getInitialValue = (linesIds: string[], song: Song): CommonLineProps => {
  const lines = linesIds.map((lineId) => distributor.getLine(lineId, song));
  const baseSkillType = lines?.[0]?.skill?.type;
  const baseSkillLevel = lines?.[0]?.skill?.level ?? 0;
  const baseAdlib = lines?.[0]?.adlib;
  const baseDismissible = lines?.[0]?.dismissible;

  const initialSkillType = lines.every((line) => line?.skill?.type === baseSkillType)
    ? baseSkillType
    : undefined;
  const initialSkillLevel = lines.every((line) => line?.skill?.level === baseSkillLevel)
    ? baseSkillLevel
    : undefined;

  return {
    skill:
      initialSkillType && initialSkillLevel
        ? { type: initialSkillType, level: initialSkillLevel }
        : undefined,
    adlib: lines.every((line) => line?.adlib === baseAdlib) ? baseAdlib : undefined,
    dismissible: lines.every((line) => line?.dismissible === baseDismissible) ? baseDismissible : undefined,
  };
};

const LINE_SKILL_OPTIONS = Object.values(LINE_SKILL).map((skill) => ({ label: skill, value: skill }));

type EditLinesFormProps = {
  linesIds: UID[];
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditLinesForm({ linesIds, onClose, setDirty }: EditLinesFormProps) {
  const { song } = useSongEditContext();
  const { onBatchUpdateSong, onMergeLines } = useSongActions();
  const [groupedLine, setTempLine] = useState<CommonLineProps>(getInitialValue(linesIds, song));

  const [form] = Form.useForm<Partial<SongLine>>();
  const isDirty = form.isFieldsTouched();

  const onValuesChange = (changedValues: Partial<SongLine>) => {
    setTempLine({ ...groupedLine, ...changedValues });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: a function shouldn't be part of this dependency
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]);

  const onApplyChanges = () => {
    const values = form.getFieldsValue();
    if (values.adlib || values.dismissible || values.skill) {
      const updates = linesIds.reduce((acc: Dictionary<UpdateValue>, lineId) => {
        Object.entries(values).forEach(([key, value]) => {
          if (value === undefined) return;

          if (typeof value !== 'object') {
            acc[`content.${lineId}.${key}`] = value;
          } else {
            Object.entries(values).forEach(([key, value]) => {
              acc[`content.${lineId}.${key}`] = value;
            });
          }
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
      initialValues={groupedLine}
      layout="vertical"
      name="edit-line-form"
      onFinish={onApplyChanges}
      onValuesChange={onValuesChange}
      preserve={false}
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
          help="Check if line is an adlib not in the flow of the song."
          label="Adlib"
          name="adlib"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          help="Check if line does not need to be displayed (vocalizing or effects)."
          label="Dismissible"
          name="dismissible"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </div>

      <Divider className="my-4" />

      <Divider />
      <Form.Item>
        <Flex gap={6}>
          <Button onClick={onClose}>Cancel</Button>
          <Button block disabled={!form.isFieldsTouched()} htmlType="submit" type="primary">
            Apply Changes
          </Button>
        </Flex>
      </Form.Item>

      <Divider />

      <Typography.Paragraph strong>Destructive Actions</Typography.Paragraph>

      <Form.Item>
        <Popconfirm
          onConfirm={() => {
            onMergeLines(linesIds);
            onClose();
          }}
          title="Are you sure you want to merge these lines?"
        >
          <Button block icon={<i className="fi fi-rr-arrows-to-line" />}>
            Merge lines
          </Button>
        </Popconfirm>
      </Form.Item>

      <Form.Item label="Move Lines to another Section">
        <MoveLinesToSectionSelector linesIds={linesIds} onSuccess={onClose} />
      </Form.Item>
    </Form>
  );
}
