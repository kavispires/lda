import { PlusOutlined } from '@ant-design/icons';
import type { CollapseProps } from 'antd';
import { Button, Collapse, Divider, Flex, Form, Input, Select, Typography } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import { useEffect, useMemo, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { SongSection } from 'types';
import { distributor } from 'utils';
import { SECTION_KINDS } from 'utils/constants';

export function AddNewSectionCollapse() {
  const [activePanel, setActivePanel] = useState<string[]>([]);
  const {
    selectionIdModel: { onDeselectAll },
  } = useSongEditContext();

  const items: CollapseProps['items'] = [
    {
      key: '1',
      label: 'Add New Section',
      children: <div>{activePanel.includes('1') && <NewSectionFlow setActivePanel={setActivePanel} />}</div>,
    },
  ];

  return (
    <Collapse
      activeKey={activePanel}
      expandIcon={({ isActive }) => <PlusOutlined rotate={isActive ? 90 : 0} />}
      items={items}
      onChange={(keys) => {
        onDeselectAll();
        setActivePanel(keys);
      }}
      size="small"
    />
  );
}

const SECTION_SKILL_OPTIONS = Object.values(SECTION_KINDS).map((skill) => ({ label: skill, value: skill }));

type NewSectionFlowProps = {
  setActivePanel: (panel: string[]) => void;
};

function NewSectionFlow({ setActivePanel }: NewSectionFlowProps) {
  const {
    song,
    selectionIdModel: { selection, onSelectOnly },
  } = useSongEditContext();
  const [form] = Form.useForm<SongSection>();
  const [tempSection, setTempSection] = useState<SongSection>(distributor.generateSection({}, song));
  const { onAddNewTextAsLinesToSection, onAddNewSection } = useSongActions();

  const [typedValue, setTypedValue] = useState<string>('');
  const [preview, setPreview] = useState<string[][]>([]);

  const parsePreview = (value: string) => {
    // Remove any multiple line breaks first
    const cleaned = value.replace(/\n{2,}/g, '\n');
    const lines = cleaned.split('\n');
    return lines.map((line) => line.split('|').map((text) => text.trim()));
  };

  const onValuesChange = (changedValues: Partial<SongSection>) => {
    setTempSection({ ...tempSection, ...changedValues });
  };

  const onCreateSection = () => {
    // Add section to song
    onAddNewSection(tempSection, selection[0]);
    // Add section to song
    onAddNewTextAsLinesToSection(tempSection.id, preview);
    // Reset form
    form.resetFields();
    setActivePanel([]);
  };

  const sectionOptions = useMemo(() => {
    return song.sectionIds.map((sectionId) => {
      const section = distributor.getSectionSummary(sectionId, song);
      return {
        label: `${section.name} (${section.id})`,
        value: section.id,
      };
    });
  }, [song]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: A function doesn't need to be part of a useEffect
  useEffect(() => {
    if (selection.length === 0) {
      onSelectOnly(song.sectionIds[song.sectionIds.length - 1]);
    }
  }, [song, selection]);

  return (
    <Form
      autoComplete="off"
      form={form}
      initialValues={tempSection}
      layout="vertical"
      name="new-section-form"
      onFinish={onCreateSection}
      onValuesChange={onValuesChange}
      preserve={false}
    >
      <Flex gap={8}>
        <Form.Item label="Kind" name="kind" style={{ width: '50%' }}>
          <Select options={SECTION_SKILL_OPTIONS} />
        </Form.Item>

        <Form.Item
          help={
            !selection[0]?.startsWith('_s')
              ? 'Selection must be a section not any other entity'
              : 'Select the section position'
          }
          // name="order"
          label="Section Order"
          style={{ width: '50%' }}
          validateStatus={!selection[0]?.startsWith('_s') ? 'error' : undefined}
        >
          <Select
            defaultValue={sectionOptions[sectionOptions.length - 1]?.value}
            onChange={(value) => onSelectOnly(value)}
            options={sectionOptions}
            value={selection[0]}
          />
        </Form.Item>
      </Flex>

      <div>
        <Typography.Title level={4}>Adding new lines</Typography.Title>
        <Typography.Paragraph className="mt-6">
          Type your new lines and parts here. To auto-split into parts use <code>|</code> for parts and a new
          line for lines.
          <br />
          <small>
            This feature won't create more than one section, so double line breaks will be ignored.
          </small>
        </Typography.Paragraph>
        <Input.TextArea
          className="mb-2"
          onChange={(e) => setTypedValue(e.target.value)}
          rows={4}
          value={typedValue}
        />
        <Button onClick={() => setPreview(parsePreview(typedValue))}>Preview</Button>
        {!!typedValue && preview.length > 0 && (
          <>
            <Divider />
            <Typography.Paragraph className="mt-4">
              <strong>Preview:</strong>
            </Typography.Paragraph>
            <Flex vertical wrap>
              {preview.map((line, lineIndex) => (
                <Flex key={lineIndex} wrap>
                  {line.map((text, index) => (
                    <Typography.Text key={index} keyboard strong style={{ color: 'dodgerBlue' }}>
                      {text}
                    </Typography.Text>
                  ))}
                </Flex>
              ))}
            </Flex>
            <Divider />
            <Button
              className="mt-4"
              disabled={!preview.length || selection.length === 0 || !selection[0]?.startsWith('_s')}
              htmlType="submit"
              type="primary"
            >
              Add Section
            </Button>
          </>
        )}
      </div>
    </Form>
  );
}
