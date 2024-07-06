import { Button, Space, Table, Typography } from 'antd';
import { ContentError } from 'components/Content';
import { useListingQuery } from 'hooks/useListingQuery';
import { useTablePagination } from 'hooks/useTablePagination';
import { useNavigate } from 'react-router-dom';
import { ListingEntry } from 'types';

export function SongsListingPage() {
  const songsQuery = useListingQuery('songs');
  const navigate = useNavigate();
  const paginationProps = useTablePagination({ total: songsQuery.data?.length ?? 0 });

  if (songsQuery.isError) {
    return <ContentError>{songsQuery.error.message}</ContentError>;
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
          <Button type="default" onClick={() => navigate(`/songs/${record.id}/edit`)}>
            Edit
          </Button>
          <Button type="primary" onClick={() => console.log(record)} disabled>
            Distribute
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="m-4">
      <Typography.Title level={2}>Songs</Typography.Title>
      <Table
        dataSource={songsQuery.data}
        columns={columns}
        rowKey="id"
        pagination={paginationProps}
        loading={songsQuery.isLoading}
      />
    </div>
  );
}
