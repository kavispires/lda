import { ArrowRightOutlined, DeleteFilled } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Typography } from 'antd';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { ListingSelect, useListingSelect } from 'components/Listing/ListingSelect';
import { useDeleteDistributionMutation } from 'hooks/useDistribution';
import { useListingQuery } from 'hooks/useListingQuery';
import { useTablePagination } from 'hooks/useTablePagination';
import { Link, useNavigate } from 'react-router-dom';
import type { DistributionListingData, ListingEntry } from 'types';

const ALL_GROUPS = 'All Groups';

export function DistributionsListingPage() {
  const distributionsQuery = useListingQuery('distributions');
  const deleteDistributionMutation = useDeleteDistributionMutation();
  const navigate = useNavigate();

  const { options, activeValue, activeList } = useListingSelect(distributionsQuery.data, 'group', ALL_GROUPS);

  const paginationProps = useTablePagination({ total: activeList.length, resetter: activeValue });

  if (distributionsQuery.isLoading) {
    return <ContentLoading />;
  }

  if (distributionsQuery.isError) {
    return <ContentError>{distributionsQuery.error.message}</ContentError>;
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ListingEntry) => (
        <Link to={`/distributions/${record.id}`}>
          {name} <ArrowRightOutlined />
        </Link>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Id',
      dataIndex: 'id',
      'key:': 'id',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: ListingEntry) => (
        <Space size="middle">
          <Button type="default" onClick={() => navigate(`/distributions/${record.id}/edit`)}>
            Edit
          </Button>

          <Popconfirm
            title="Are you sure you want to delete this distribution?"
            onConfirm={() => deleteDistributionMutation.mutate(record.id)}
          >
            <Button icon={<DeleteFilled />} loading={deleteDistributionMutation.isPending} danger />
          </Popconfirm>
        </Space>
      ),
    },
    {
      title: 'Formation',
      render: (record: ListingEntry<DistributionListingData>) => (
        <Space size="middle">
          {record?.data?.formationId ? (
            <Button
              icon={<i className="fi fi-rr-map-marker-edit"></i>}
              onClick={() => navigate(`/distributions/${record.id}/formation/${record?.data?.formationId}`)}
            >
              Edit
            </Button>
          ) : (
            <Button
              icon={<i className="fi fi-rr-marker"></i>}
              onClick={() => navigate(`/distributions/${record.id}/formation/$draft`)}
            >
              Create
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Content>
      <Typography.Title level={2}>Distributions</Typography.Title>
      <ListingSelect options={options} paramKey="group" allKey={ALL_GROUPS} className="mb-2" />
      <Table
        dataSource={activeList}
        columns={columns}
        rowKey="id"
        pagination={paginationProps}
        loading={distributionsQuery.isLoading}
      />
    </Content>
  );
}
