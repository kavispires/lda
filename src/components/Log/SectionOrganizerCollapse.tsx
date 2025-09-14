import { UnorderedListOutlined } from '@ant-design/icons';
import type { CollapseProps } from 'antd';
import { App, Button, Collapse, Divider, Flex, Form, Input, Typography } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import { useEffect, useMemo, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { UID } from 'types';
import { distributor } from 'utils';
import { NULL } from 'utils/constants';

export function SectionOrganizerCollapse() {
  const [activePanel, setActivePanel] = useState<string[]>([]);
  const {
    selectionIdModel: { onDeselectAll },
  } = useSongEditContext();

  const items: CollapseProps['items'] = [
    {
      key: '1',
      label: 'Section Organizer',
      children: (
        <div>{activePanel.includes('1') && <SectionOrganizerFlow setActivePanel={setActivePanel} />}</div>
      ),
    },
  ];
  return (
    <Collapse
      items={items}
      size="small"
      activeKey={activePanel}
      expandIcon={({ isActive }) => <UnorderedListOutlined rotate={isActive ? 180 : 0} />}
      onChange={(keys) => {
        onDeselectAll();

        setActivePanel(keys);
      }}
    />
  );
}

type SectionOrganizerFlowProps = {
  setActivePanel: (panel: string[]) => void;
};

type SortSectionFormValues = {
  sectionId: UID;
};

function SectionOrganizerFlow({ setActivePanel }: SectionOrganizerFlowProps) {
  const {
    song,
    selectionIdModel: { selection, onSelectOnly },
  } = useSongEditContext();
  const [form] = Form.useForm<SortSectionFormValues>();
  const { message } = App.useApp();
  const { onSortSection } = useSongActions();

  const { onNumberSections } = useSongActions();

  const isAnySectionKindNull = useMemo(() => {
    return song.sectionIds.some((id) => {
      const section = distributor.getSection(id, song);
      return section.kind === NULL;
    });
  }, [song]);

  // Watch form values for real-time validation
  const selectedSectionId = Form.useWatch('sectionId', form) ?? 0;

  const onSubmitSort = (changedValues: SortSectionFormValues) => {
    if (!changedValues.sectionId) {
      message.error('Section ID is a required field');
      return;
    }
    onSortSection(changedValues.sectionId);
    form.resetFields();
    setActivePanel([]);
  };

  // Make sure that only a line is selected
  // biome-ignore lint/correctness/useExhaustiveDependencies: functions should not be dependencies
  useEffect(() => {
    if (selection.length > 1) {
      message.info('Auto-deselecting previous entities');
      onSelectOnly(selection[selection.length - 1]);
    }
    if (selection.length === 1) {
      const firstElement = selection[0];
      if (firstElement.startsWith('_l')) {
        // Find section the line belongs to
        const line = distributor.getLine(firstElement, song);
        if (line) {
          message.info('Auto-selecting the section this line belongs to');
          onSelectOnly(line.sectionId);
        }
      }
      if (firstElement.startsWith('_p')) {
        // Find line the part belongs to
        const part = distributor.getPart(firstElement, song);
        if (part) {
          const line = distributor.getLine(part.lineId, song);
          if (line) {
            message.info('Auto-selecting the section this part belongs to');
            onSelectOnly(line.sectionId);
          }
        }
      }
    }
  }, [song, selection]);

  useEffect(() => {
    form.setFieldsValue({
      sectionId: selection[0] || undefined,
    });
  }, [form, selection]);

  const unableToSort = useMemo(() => {
    if (!selectedSectionId) return true;
    if (!selectedSectionId.startsWith('_s')) return true;

    const sectionSummary = distributor.getSectionSummary(selectedSectionId, song);
    return !sectionSummary.partIds.every((partId) => distributor.getPartDuration(partId, song) > 0);
  }, [song, selectedSectionId]);

  return (
    <>
      <Typography.Title level={5} className="my-0">
        Re-number sections
      </Typography.Title>
      <Typography.Paragraph>
        You can only renumber sections when all of them have a defined kind (not "None"). If they are red,
        please assign a valid kind.
      </Typography.Paragraph>
      <Button
        block
        icon={<i className="fi fi-ss-arrow-progress" />}
        onClick={() => {
          onNumberSections();
          setActivePanel([]);
        }}
        disabled={isAnySectionKindNull}
        type="primary"
      >
        Trigger
      </Button>

      <Divider />

      <Typography.Title level={5} className="my-0">
        Re-sort section
      </Typography.Title>

      <Form
        form={form}
        layout="vertical"
        name="sort-section-form"
        initialValues={{
          sectionId: selection[0] || undefined,
        }}
        autoComplete="off"
        preserve={false}
        onFinish={onSubmitSort}
      >
        <Typography.Paragraph>
          You must click any line (or part or section) to be the start of the nudge, or select Entire song.
        </Typography.Paragraph>
        <Flex gap={8}>
          <Form.Item
            label="Section Id"
            name="sectionId"
            style={{ width: '50%' }}
            help={!selectedSectionId ? 'Section Id is required' : undefined}
          >
            <Input readOnly />
          </Form.Item>
          <Form.Item
            label=" "
            style={{ width: '50%' }}
            help={unableToSort ? 'All parts must be timed' : undefined}
          >
            <Button type="primary" htmlType="submit" disabled={unableToSort} block>
              Sort
            </Button>
          </Form.Item>
        </Flex>

        <div>
          <Divider className="my-1" />
          <Flex justify="space-between" gap={12}>
            <Button type="default" onClick={() => setActivePanel([])}>
              Close
            </Button>
          </Flex>
        </div>
      </Form>
    </>
  );
}
