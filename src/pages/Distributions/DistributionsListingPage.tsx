import { BarChartOutlined, DeleteFilled, FormOutlined } from '@ant-design/icons';
import { Button, Divider, Flex, Popconfirm, Space, Table, type TableProps, Tooltip, Typography } from 'antd';
import { FirestoreConsoleLink } from 'components/Common/FirestoreConsoleLink';
import { Timestamp } from 'components/Common/Timestamp';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { ListingSelect, useListingSelect } from 'components/Listing/ListingSelect';
import { useDeleteDistributionMutation } from 'hooks/useDistribution';
import { useListingQuery } from 'hooks/useListingQuery';
import { useQueryParams } from 'hooks/useQueryParams';
import { useTablePagination } from 'hooks/useTablePagination';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DistributionListingData, ListingEntry, UID } from 'types';
import { SEPARATOR } from 'utils/constants';

const ALL_GROUPS = 'All Groups';

export function DistributionsListingPage() {
  const distributionsQuery = useListingQuery('distributions');
  const deleteDistributionMutation = useDeleteDistributionMutation();
  const navigate = useNavigate();

  const { options, activeValue, activeList } = useListingSelect(distributionsQuery.data, 'group', ALL_GROUPS);

  const { queryParams } = useQueryParams();

  const paginationProps = useTablePagination({
    total: activeList.length,
    resetter: activeValue,
    defaultCurrent: Number(queryParams.get('page') ?? 1),
  });

  if (distributionsQuery.isLoading) {
    return <ContentLoading />;
  }

  if (distributionsQuery.isError) {
    return <ContentError>{distributionsQuery.error.message}</ContentError>;
  }

  const columns: TableProps<ListingEntry>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: ListingEntry, b: ListingEntry) => a.name.localeCompare(b.name),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: ListingEntry) => (
        <Space separator={<Divider orientation="vertical" />} size="small">
          <Button
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/distributions/${record.id}`)}
            type="link"
          >
            View
          </Button>
          <Button
            icon={<FormOutlined />}
            onClick={() => navigate(`/distributions/${record.id}/edit`)}
            type="link"
          >
            Edit
          </Button>
        </Space>
      ),
    },
    {
      title: 'Snippet',
      dataIndex: ['data', 'snippet'],
      key: 'snippet',
      render: (snippet: string) => <DistributionSnippet snippet={snippet} />,
    },
    {
      title: 'Formation',
      render: (record: ListingEntry<DistributionListingData>) => (
        <Space size="middle">
          {record?.data?.formationId ? (
            <Button
              icon={<i className="fi fi-rr-map-marker-edit"></i>}
              onClick={() => navigate(`/distributions/${record.id}/formation/${record?.data?.formationId}`)}
              size="small"
              type="link"
            >
              Edit
            </Button>
          ) : (
            <Button
              icon={<i className="fi fi-rr-marker"></i>}
              onClick={() => navigate(`/distributions/${record.id}/formation/$draft`)}
              size="small"
            >
              Create
            </Button>
          )}
        </Space>
      ),
    },
    {
      title: 'id',
      dataIndex: 'id',
      key: 'id',
      render: (id: UID) => <FirestoreConsoleLink label={id} path={`songs/${id}`} />,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: (a: ListingEntry, b: ListingEntry) => (a.updatedAt || 0) - (b.updatedAt || 0),
      render: (updatedAt: number) => <Timestamp timestamp={updatedAt} />,
    },
    {
      title: 'More',
      dataIndex: 'id',
      render: (songId: UID) => (
        <Space size="middle">
          <Popconfirm
            onConfirm={() => deleteDistributionMutation.mutate(songId)}
            title="Are you sure you want to delete this distribution?"
          >
            <Button
              danger
              icon={<DeleteFilled />}
              loading={deleteDistributionMutation.isPending}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Content>
      <Typography.Title level={2}>Distributions</Typography.Title>
      <Flex align="center" justify="space-between">
        <ListingSelect allKey={ALL_GROUPS} className="mb-2" options={options} paramKey="group" />
        <Flex align="center" gap={6}>
          <FirestoreConsoleLink label="Listing" path="listings/distributions" />
          <FirestoreConsoleLink label="Distributions" path="distributions" />
        </Flex>
      </Flex>
      <Table
        columns={columns}
        dataSource={activeList}
        loading={distributionsQuery.isLoading}
        pagination={paginationProps}
        rowKey="id"
      />
    </Content>
  );
}

type DistributionSnippetProps = {
  snippet: string;
};

function DistributionSnippet({ snippet = '' }: DistributionSnippetProps) {
  const parsedSnippet = useMemo(() => snippet.split(SEPARATOR).map((part) => part.split('|')), [snippet]);

  if (!snippet) {
    return <Typography.Text type="secondary">No data</Typography.Text>;
  }

  // Parsed snippet is an array of [color, percentage, name], create a 200px wide bar that has segments with the corresponding colors and widths based on the percentage, and show the tooltip name on hover

  return (
    <div style={{ display: 'flex', width: '284px', height: '24px', borderRadius: '4px', overflow: 'hidden' }}>
      {parsedSnippet.map(([color, percentage, name], index) => (
        <Tooltip key={index} title={`${name}: ${percentage}%`}>
          <div
            style={{
              backgroundColor: color,
              width: `${percentage}%`,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#fff',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {percentage}
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
