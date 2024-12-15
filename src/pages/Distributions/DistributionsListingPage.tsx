// import './GroupsListingPage.scss';

import { Button, Space, Table, Typography } from 'antd';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { ListingSelect, useListingSelect } from 'components/Listing/ListingSelect';
import { useListingQuery } from 'hooks/useListingQuery';
import { useTablePagination } from 'hooks/useTablePagination';
import { useNavigate } from 'react-router-dom';
import { ListingEntry } from 'types';

const ALL_GROUPS = 'All Groups';

export function DistributionsListingPage() {
  const distributionsQuery = useListingQuery('distributions');
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
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: ListingEntry) => (
        <Space size="middle">
          <Button type="default" onClick={() => navigate(`/distributions/${record.id}/edit`)}>
            Edit
          </Button>
          <Button type="primary" onClick={() => navigate(`/distributions/${record.id}`)}>
            View
          </Button>
        </Space>
      ),
    },
    {
      title: 'id',
      dataIndex: 'id',
      'key:': 'id',
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
