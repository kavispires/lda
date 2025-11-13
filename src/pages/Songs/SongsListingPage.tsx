import { DeleteFilled } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Typography } from 'antd';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { ListingSelect, useListingSelect } from 'components/Listing/ListingSelect';
import { useListingQuery } from 'hooks/useListingQuery';
import { useDeleteSongMutation } from 'hooks/useSong';
import { useTablePagination } from 'hooks/useTablePagination';
import { useNavigate } from 'react-router-dom';
import type { ListingEntry, UID } from 'types';

const ALL_SONGS = 'All Songs';

export function SongsListingPage() {
  const songsQuery = useListingQuery('songs');
  const deleteSongMutation = useDeleteSongMutation();
  const navigate = useNavigate();

  const { options, activeValue, activeList } = useListingSelect(songsQuery.data, 'group', ALL_SONGS);

  const paginationProps = useTablePagination({ total: activeList.length, resetter: activeValue });

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
          <Button onClick={() => navigate(`/songs/${record.id}/edit`)} type="default">
            Edit
          </Button>
          <Button onClick={() => navigate(`/distributions/new?songId=${record.id}`)} type="primary">
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
            onConfirm={() => deleteSongMutation.mutate(songId)}
            title="Are you sure you want to delete this song?"
          >
            <Button danger icon={<DeleteFilled />} loading={deleteSongMutation.isPending} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Content>
      <Typography.Title level={2}>Songs</Typography.Title>
      <ListingSelect allKey={ALL_SONGS} className="mb-2" options={options} paramKey="group" />
      <Table
        columns={columns}
        dataSource={activeList}
        loading={songsQuery.isLoading}
        pagination={paginationProps}
        rowKey="id"
      />
    </Content>
  );
}
