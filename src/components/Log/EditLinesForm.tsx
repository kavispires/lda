import { useSongActions } from '@hooks/useSongActions';
import { useSongEditContext } from '@services/SongEditProvider';
import type { Dictionary, Song, SongLine, UID, UpdateValue } from '@types';
import { distributor } from '@utils';
import { LINE_SKILL } from '@utils/constants';
import { applyLineFlagChanges, isInlineEligible } from '@utils/song/line-flags';
import { Button, Divider, Flex, Form, Input, Popconfirm, Rate, Select, Switch, Typography } from 'antd';
import { InfoIcon, MergeIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { MoveLinesToSectionSelector } from './MoveLinesToSectionSelector';

type CommonLineProps = Pick<SongLine, 'skill' | 'adlib' | 'dismissible' | 'inline'>;
type BulkLineChanges = Partial<Pick<SongLine, 'adlib' | 'dismissible' | 'inline'>> & {
  'skill.type'?: string;
  'skill.level'?: number;
};

const getInitialValue = (linesIds: string[], song: Song): CommonLineProps => {
  const lines = linesIds.map((lineId) => distributor.getLine(lineId, song));
  const baseSkillType = lines?.[0]?.skill?.type;
  const baseSkillLevel = lines?.[0]?.skill?.level ?? 0;
  const baseAdlib = !!lines?.[0]?.adlib;
  const baseDismissible = !!lines?.[0]?.dismissible;
  const baseInline = !!lines?.[0]?.inline;

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
    adlib: lines.every((line) => !!line?.adlib === baseAdlib) ? baseAdlib : undefined,
    dismissible: lines.every((line) => !!line?.dismissible === baseDismissible) ? baseDismissible : undefined,
    inline: lines.every((line) => !!line?.inline === baseInline) ? baseInline : undefined,
  };
};

export function buildBulkLineUpdates(lines: SongLine[], changes: BulkLineChanges): Dictionary<UpdateValue> {
  const updates: Dictionary<UpdateValue> = {};
  for (const line of lines) {
    const next = applyLineFlagChanges(line, changes);
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) {
        updates[`content.${line.id}.${key}`] = value;
      }
    }
    if (next.inline !== line.inline || changes.inline !== undefined) {
      updates[`content.${line.id}.inline`] = !!next.inline;
    }
    if (changes.adlib) {
      updates[`content.${line.id}.harmonyOf`] = '';
    }
  }
  return updates;
}

const LINE_SKILL_OPTIONS = Object.values(LINE_SKILL).map((skill) => ({ label: skill, value: skill }));

type EditLinesFormProps = {
  linesIds: UID[];
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditLinesForm({ linesIds, onClose, setDirty }: EditLinesFormProps) {
  const { song } = useSongEditContext();
  const { onBatchUpdateSong, onMergeLines } = useSongActions();
  const [groupedLine] = useState<CommonLineProps>(getInitialValue(linesIds, song));
  const [changes, setChanges] = useState<BulkLineChanges>({});
  const lines = linesIds.map((lineId) => distributor.getLine(lineId, song));
  const inlineEligible = lines.every((line) => isInlineEligible(applyLineFlagChanges(line, changes)));

  const [form] = Form.useForm<SongLine>();
  const isDirty = form.isFieldsTouched();

  const onValuesChange = (changedValues: BulkLineChanges) => {
    const nextChanges = { ...changes, ...changedValues };
    if (
      nextChanges.inline &&
      !lines.every((line) => isInlineEligible(applyLineFlagChanges(line, nextChanges)))
    ) {
      nextChanges.inline = false;
      form.setFieldsValue({ inline: false });
    }
    if (nextChanges.adlib === false || nextChanges.dismissible === true) {
      nextChanges.inline = false;
      form.setFieldsValue({ inline: false });
    }
    setChanges(nextChanges);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: a function shouldn't be part of this dependency
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]);

  const onApplyChanges = () => {
    const updates = buildBulkLineUpdates(lines, changes);
    if (Object.keys(updates).length > 0) {
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

      <div className="grid grid-cols-3 gap-2">
        <Form.Item
          label="Adlib"
          name="adlib"
          tooltip={{
            title:
              'Set line as an adlib. Adlibs are marked with >> in the main log and displayed on the side unless Inline is enabled.',
            icon: <InfoIcon />,
          }}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Inline"
          name="inline"
          tooltip={{
            title:
              'Display this adlib in the main lyrics while keeping its adlib totals. Inline Adlib is represented in the log but a single >.',
            icon: <InfoIcon />,
          }}
          valuePropName="checked"
        >
          <Switch disabled={!inlineEligible} />
        </Form.Item>

        <Form.Item
          label="Dismissible"
          name="dismissible"
          tooltip={{
            title: 'Check if line does not need to be displayed (vocalizing or effects).',
            icon: <InfoIcon />,
          }}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </div>

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
          <Button block icon={<MergeIcon />}>
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
