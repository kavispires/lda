import { DeleteFilled } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Typography } from 'antd';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { useListingQuery } from 'hooks/useListingQuery';
import { useDeleteSongMutation } from 'hooks/useSong';
import { useTablePagination } from 'hooks/useTablePagination';
import { useNavigate } from 'react-router-dom';
import { ListingEntry, UID } from 'types';

export function SongsListingPage() {
  const songsQuery = useListingQuery('songs');
  const deleteSongMutation = useDeleteSongMutation();
  const navigate = useNavigate();
  const paginationProps = useTablePagination({ total: songsQuery.data?.list?.length ?? 0 });

  if (songsQuery.isLoading) {
    return <ContentLoading />;
  }

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
      key: 'actions',
      render: (record: ListingEntry) => (
        <Space size="middle">
          <Button type="default" onClick={() => navigate(`/songs/${record.id}/edit`)}>
            Edit
          </Button>
          <Button type="primary" onClick={() => navigate(`/distributions/new?songId=${record.id}`)}>
            Distribute
          </Button>
        </Space>
      ),
    },
    {
      title: 'id',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'More',
      dataIndex: 'id',
      render: (songId: UID) => (
        <Space size="middle">
          <Popconfirm
            title="Are you sure you want to delete this song?"
            onConfirm={() => deleteSongMutation.mutate(songId)}
          >
            <Button icon={<DeleteFilled />} loading={deleteSongMutation.isPending} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Content>
      <Typography.Title level={2}>Songs</Typography.Title>
      <Table
        dataSource={songsQuery.data?.list}
        columns={columns}
        rowKey="id"
        pagination={paginationProps}
        loading={songsQuery.isLoading}
      />
    </Content>
  );
}
