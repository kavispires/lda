import { Content, ContentError, ContentLoading } from '@components/Content';
import { Stage } from '@components/Formation/Stage';
import { UnsavedChanges } from '@components/Formation/UnsavedChanges';
import {
  useDeleteFormationTemplateMutation,
  useFormationTemplatesQuery,
  useSaveFormationTemplateMutation,
} from '@hooks/useDanceFormation';
import { useEditHistory } from '@hooks/useEditHistory';
import type { FormationTemplate } from '@types';
import { initialPose, poseErrors } from '@utils/formation';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Flex,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

export function FormationTemplatesPage() {
  const query = useFormationTemplatesQuery();
  const remove = useDeleteFormationTemplateMutation();
  const { templateId } = useParams();
  const [params] = useSearchParams();
  if (query.isPending) return <ContentLoading>Loading formation templates...</ContentLoading>;
  if (query.isError) return <ContentError>{query.error.message}</ContentError>;
  if (templateId) {
    const count = params.get('count') === '7' ? 7 : 5;
    const template: FormationTemplate | undefined =
      templateId === 'new'
        ? {
            id: '$draft',
            name: '',
            dancerCount: count,
            createdAt: Date.now(),
            positions: Object.values(
              initialPose(Array.from({ length: count }, (_, index) => String(index + 1))),
            ),
          }
        : query.data.find((item) => item.id === templateId);
    if (!template) return <ContentError>Formation template not found.</ContentError>;
    return <TemplateEditor initial={template} key={`${templateId}:${count}`} />;
  }
  return (
    <Content>
      <Typography.Title level={2}>Formation Templates</Typography.Title>
      <Flex className="mb-4" gap={8} wrap>
        <Link to="/formation-templates/new?count=5">
          <Button type="primary">Create 5-dancer template</Button>
        </Link>
        <Link to="/formation-templates/new?count=7">
          <Button>Create 7-dancer template</Button>
        </Link>
      </Flex>
      <Table
        columns={[
          { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
          {
            title: 'Dancers',
            dataIndex: 'dancerCount',
            filters: [
              { text: '5 dancers', value: 5 },
              { text: '7 dancers', value: 7 },
            ],
            onFilter: (value, row) => row.dancerCount === value,
          },
          {
            title: 'Preview',
            render: (_, row) => (
              <div style={{ width: 220 }}>
                <Stage
                  positions={Object.fromEntries(row.positions.map((pos, index) => [String(index + 1), pos]))}
                />
              </div>
            ),
          },
          {
            title: 'Actions',
            render: (_, row) => (
              <Space>
                <Link to={`/formation-templates/${row.id}`}>
                  <Button>Edit / Rename</Button>
                </Link>
                <Popconfirm
                  description="Existing choreography will not change."
                  onConfirm={() => remove.mutate(row.id)}
                  title="Delete template?"
                >
                  <Button danger loading={remove.isPending && remove.variables === row.id}>
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        dataSource={query.data}
        rowKey="id"
      />
    </Content>
  );
}

function TemplateEditor({ initial }: { initial: FormationTemplate }) {
  const history = useEditHistory(initial);
  const template = history.value;
  const mutation = useSaveFormationTemplateMutation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [halfSteps, setHalfSteps] = useState(false);
  const positions = Object.fromEntries(template.positions.map((pos, index) => [String(index + 1), pos]));
  const errors = poseErrors(positions);
  return (
    <Content>
      <UnsavedChanges dirty={history.dirty} />
      <Typography.Title level={2}>{template.dancerCount}-dancer template</Typography.Title>
      <Space className="w-100" orientation="vertical" size="middle">
        {errors.length > 0 && (
          <Alert description={errors.join(' ')} title="Correct template positions" type="error" />
        )}
        <Flex align="center" gap={8} wrap>
          <Input
            aria-label="Template name"
            disabled={mutation.isPending}
            maxLength={100}
            onChange={(event) => history.edit({ ...template, name: event.target.value })}
            placeholder="Template name"
            style={{ maxWidth: 360 }}
            value={template.name}
          />
          <Button disabled={!history.canUndo || mutation.isPending} onClick={history.undo}>
            Undo
          </Button>
          <Button disabled={!history.canRedo || mutation.isPending} onClick={history.redo}>
            Redo
          </Button>
          <Button
            disabled={!template.name.trim() || errors.length > 0}
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(template, {
                onSuccess: (saved) => {
                  flushSync(() => history.markSaved(saved));
                  navigate(`/formation-templates/${saved.id}`, { replace: true });
                },
              })
            }
            type="primary"
          >
            Save template
          </Button>
          <Link to="/formation-templates">Back to library</Link>
          <Typography.Text type="secondary">
            {history.dirty ? 'Unsaved changes' : template.id === '$draft' ? 'New template' : 'Saved state'}
          </Typography.Text>
        </Flex>
        <Flex align="center" gap={12} wrap>
          <Checkbox checked={halfSteps} onChange={(event) => setHalfSteps(event.target.checked)}>
            Allow half-cell steps
          </Checkbox>
          <Select
            aria-label="Selected template positions"
            mode="multiple"
            onChange={setSelected}
            options={Object.keys(positions).map((id) => ({ value: id, label: id }))}
            placeholder="Select positions to move together"
            style={{ minWidth: 280 }}
            value={selected}
          />
          <Typography.Text type="secondary">
            Shift-click to multi-select; numbered positions have no artist identity.
          </Typography.Text>
        </Flex>
        <div style={{ maxWidth: 1000, paddingRight: 4 }}>
          <Stage
            disabled={mutation.isPending}
            fitViewport
            halfSteps={halfSteps}
            onInvalid={(error) => message.error(error)}
            onMove={(next) =>
              history.edit({ ...template, positions: Object.keys(positions).map((id) => next[id]) })
            }
            onSelection={setSelected}
            positions={positions}
            selected={selected}
          />
        </div>
      </Space>
    </Content>
  );
}
