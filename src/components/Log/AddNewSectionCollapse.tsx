import type { CollapseProps } from 'antd';
import { Button, Collapse, Divider, Flex, Form, Input, Select, Typography } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import { useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { SongSection } from 'types';
import { distributor } from 'utils';
import { SECTION_KINDS } from 'utils/constants';

export function AddNewSectionCollapse() {
  const [activePanel, setActivePanel] = useState<string[]>([]);

  const items: CollapseProps['items'] = [
    {
      key: '1',
      label: 'Add New Section',
      children: <div>{activePanel.includes('1') && <NewSectionFlow setActivePanel={setActivePanel} />}</div>,
      showArrow: false,
    },
  ];

  return (
    <Collapse items={items} size="small" activeKey={activePanel} onChange={(keys) => setActivePanel(keys)} />
  );
}

const SECTION_SKILL_OPTIONS = Object.values(SECTION_KINDS).map((skill) => ({ label: skill, value: skill }));

type NewSectionFlowProps = {
  setActivePanel: (panel: string[]) => void;
};

function NewSectionFlow({ setActivePanel }: NewSectionFlowProps) {
  const { song } = useSongEditContext();
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
    onAddNewSection(tempSection);
    // Add section to song
    onAddNewTextAsLinesToSection(tempSection.id, preview);
    // Reset form
    form.resetFields();
    setActivePanel([]);
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
      onFinish={onCreateSection}
    >
      <Form.Item label="Kind" name="kind">
        <Select options={SECTION_SKILL_OPTIONS} />
      </Form.Item>

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
          value={typedValue}
          onChange={(e) => setTypedValue(e.target.value)}
          rows={4}
        />
        <Button onClick={() => setPreview(parsePreview(typedValue))}>Preview</Button>
        {!!typedValue && preview.length > 0 && (
          <>
            <Divider />
            <Typography.Paragraph className="mt-4">
              <strong>Preview:</strong>
            </Typography.Paragraph>
            <Flex wrap vertical>
              {preview.map((line, lineIndex) => (
                <Flex wrap key={lineIndex}>
                  {line.map((text, index) => (
                    <Typography.Text key={index} strong keyboard style={{ color: 'dodgerBlue' }}>
                      {text}
                    </Typography.Text>
                  ))}
                </Flex>
              ))}
            </Flex>
            <Divider />
            <Button type="primary" htmlType="submit" disabled={!preview.length} className="mt-4">
              Add Section
            </Button>
          </>
        )}
      </div>
    </Form>
  );
}
