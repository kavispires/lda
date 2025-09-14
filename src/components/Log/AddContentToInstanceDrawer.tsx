import { Button, Divider, Flex, Input, Typography } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import type React from 'react';
import { useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { UID } from 'types';
import { distributor } from 'utils';

type AddContentToInstanceDrawerProps = {
  instanceId: UID;
  instanceType: string;
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function AddContentToInstanceDrawer(props: AddContentToInstanceDrawerProps) {
  if (props.instanceType === 'line') {
    return <AddingNewParts {...props} />;
  }

  if (props.instanceType === 'section') {
    return <AddingNewLines {...props} />;
  }

  return (
    <div>
      <Typography.Text color="error">
        Unsupported instance type:
        {props.instanceType}
      </Typography.Text>
    </div>
  );
}

function AddingNewParts({ instanceId }: AddContentToInstanceDrawerProps) {
  const { song } = useSongEditContext();
  const { onAddNewTextAsPartsToLine } = useSongActions();

  const parts = distributor.getLineParts(instanceId, song);

  const [typedValue, setTypedValue] = useState<string>('');
  const [preview, setPreview] = useState<string[]>([]);

  return (
    <div>
      <Typography.Title level={4}>Adding new parts to line</Typography.Title>

      <Flex wrap>
        {parts.map((part) => (
          <Typography.Text key={part.id} strong keyboard>
            {part.text}
          </Typography.Text>
        ))}
      </Flex>

      <Typography.Paragraph className="mt-6">
        Type your new line here. To auto-split into parts use <code>|</code>.
      </Typography.Paragraph>
      <Input className="mb-2" value={typedValue} onChange={(e) => setTypedValue(e.target.value)} />
      <Button onClick={() => setPreview(typedValue.split('|').map((text) => text.trim()))}>Preview</Button>

      {!!typedValue && preview.length > 0 && (
        <>
          <Divider />
          <Typography.Paragraph className="mt-4">
            <strong>Preview:</strong>
          </Typography.Paragraph>
          <Flex wrap>
            {parts.map((part) => (
              <Typography.Text key={part.id} strong keyboard>
                {part.text}
              </Typography.Text>
            ))}
            {preview.map((text, index) => (
              <Typography.Text key={index} strong keyboard style={{ color: 'dodgerBlue' }}>
                {text}
              </Typography.Text>
            ))}
          </Flex>
          <Divider />
          <Button
            type="primary"
            onClick={() => onAddNewTextAsPartsToLine(instanceId, preview)}
            className="mt-4"
          >
            Add New Parts
          </Button>
        </>
      )}
    </div>
  );
}

function AddingNewLines({ instanceId }: AddContentToInstanceDrawerProps) {
  const { song } = useSongEditContext();
  const { onAddNewTextAsLinesToSection } = useSongActions();

  const section = distributor.getSectionSummary(instanceId, song);

  const [typedValue, setTypedValue] = useState<string>('');
  const [preview, setPreview] = useState<string[][]>([]);

  const parsePreview = (value: string) => {
    // Remove any multiple line breaks first
    const cleaned = value.replace(/\n{2,}/g, '\n');
    const lines = cleaned.split('\n');
    return lines.map((line) => line.split('|').map((text) => text.trim()));
  };

  return (
    <div>
      <Typography.Title level={4}>Adding new lines to section</Typography.Title>
      <Typography.Title level={5}>{section.name}</Typography.Title>
      <Typography.Paragraph className="mt-6">
        Type your new lines and parts here. To auto-split into parts use <code>|</code> for parts and a new
        line for lines.
        <br />
        <small>This feature won't create new sections, so double line breaks will be ignored.</small>
      </Typography.Paragraph>
      <Input.TextArea
        className="mb-2"
        value={typedValue}
        onChange={(e) => setTypedValue(e.target.value)}
        rows={6}
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
          <Button
            type="primary"
            onClick={() => onAddNewTextAsLinesToSection(instanceId, preview)}
            className="mt-4"
          >
            Add New Lines
          </Button>
        </>
      )}
    </div>
  );
}
