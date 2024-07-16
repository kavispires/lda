// import './GroupsListingPage.scss';

import { Button, Space, Table, Typography } from 'antd';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { useListingQuery } from 'hooks/useListingQuery';
import { useTablePagination } from 'hooks/useTablePagination';
import { useNavigate } from 'react-router-dom';
import { ListingEntry } from 'types';

export function DistributionsListingPage() {
  const distributionsQuery = useListingQuery('distributions');
  const navigate = useNavigate();
  const paginationProps = useTablePagination({ total: distributionsQuery.data?.list?.length ?? 0 });

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
      key: 'id',
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
  ];

  return (
    <Content>
      <Typography.Title level={2}>Distributions</Typography.Title>
      <Table
        dataSource={distributionsQuery.data?.list}
        columns={columns}
        rowKey="id"
        pagination={paginationProps}
        loading={distributionsQuery.isLoading}
      />
    </Content>
  );
}
