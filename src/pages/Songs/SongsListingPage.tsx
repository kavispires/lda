import { BarChartOutlined, DeleteFilled, FormOutlined } from '@ant-design/icons';
import { Button, Divider, Flex, Popconfirm, Space, Table, type TableProps, Typography } from 'antd';
import { FirestoreConsoleLink } from 'components/Common/FirestoreConsoleLink';
import { Timestamp } from 'components/Common/Timestamp';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { ListingSelect, useListingSelect } from 'components/Listing/ListingSelect';
import { useListingQuery } from 'hooks/useListingQuery';
import { useQueryParams } from 'hooks/useQueryParams';
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

  const { queryParams } = useQueryParams();
  const paginationProps = useTablePagination({
    total: activeList.length,
    resetter: activeValue,
    defaultCurrent: Number(queryParams.get('page') ?? 1),
  });

  if (songsQuery.isLoading) {
    return <ContentLoading />;
  }

  if (songsQuery.isError) {
    return <ContentError>{songsQuery.error.message}</ContentError>;
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
          <Button icon={<FormOutlined />} onClick={() => navigate(`/songs/${record.id}/edit`)} type="link">
            Edit
          </Button>
          <Button
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/distributions/new?songId=${record.id}`)}
            type="link"
          >
            Distribute
          </Button>
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
            onConfirm={() => deleteSongMutation.mutate(songId)}
            title="Are you sure you want to delete this song?"
          >
            <Button danger icon={<DeleteFilled />} loading={deleteSongMutation.isPending} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Content>
      <Typography.Title level={2}>Songs</Typography.Title>
      <Flex align="center" justify="space-between">
        <ListingSelect allKey={ALL_SONGS} className="mb-2" options={options} paramKey="group" />
        <Flex align="center" gap={6}>
          <FirestoreConsoleLink label="Listing" path="listings/songs" />
          <FirestoreConsoleLink label="Songs" path="songs" />
        </Flex>
      </Flex>
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
