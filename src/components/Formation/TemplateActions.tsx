import { useFormationTemplatesQuery, useSaveFormationTemplateMutation } from '@hooks/useDanceFormation';
import type { FormationPose } from '@types';
import { assignTemplate } from '@utils/formation';
import { Alert, App, Button, Input, Modal, Select, Space } from 'antd';
import { useState } from 'react';

export function TemplateActions({
  positions,
  onApply,
  disabled = false,
}: {
  positions: FormationPose;
  onApply: (positions: FormationPose) => void;
  disabled?: boolean;
}) {
  const count = Object.keys(positions).length;
  const query = useFormationTemplatesQuery(count === 5 || count === 7);
  const save = useSaveFormationTemplateMutation();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  if (count !== 5 && count !== 7) return null;
  return (
    <Space className="w-100" orientation="vertical">
      {query.isError && (
        <Alert description={query.error.message} title="Could not load templates" type="error" />
      )}
      <Space wrap>
        <Select
          aria-label="Apply formation template"
          disabled={disabled || query.isError}
          loading={query.isPending}
          onChange={(id: string) => {
            const template = query.data?.find((item) => item.id === id);
            if (!template) {
              message.error('Template is no longer available. Reload the library.');
              return;
            }
            try {
              onApply(assignTemplate(positions, template));
            } catch (error) {
              message.error(error instanceof Error ? error.message : String(error));
            }
          }}
          options={query.data
            ?.filter((item) => item.dancerCount === count)
            .map((item) => ({ label: item.name, value: item.id }))}
          placeholder={`Apply ${count}-dancer template`}
          style={{ width: 240, maxWidth: '100%' }}
          value={undefined}
        />
        <Button
          disabled={disabled}
          onClick={() => {
            setName('');
            setOpen(true);
          }}
        >
          Save as template
        </Button>
      </Space>
      <Modal
        confirmLoading={save.isPending}
        okButtonProps={{ disabled: !name.trim() }}
        onCancel={() => {
          if (!save.isPending) setOpen(false);
        }}
        onOk={() =>
          save.mutate(
            {
              id: '$draft',
              name: name.trim(),
              dancerCount: count,
              positions: Object.keys(positions)
                .sort()
                .map((id) => ({ ...positions[id] })),
              createdAt: Date.now(),
            },
            { onSuccess: () => setOpen(false) },
          )
        }
        open={open}
        title="Save snapshot as template"
      >
        <Input
          aria-label="Template name"
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          placeholder="Template name"
          value={name}
        />
      </Modal>
    </Space>
  );
}
