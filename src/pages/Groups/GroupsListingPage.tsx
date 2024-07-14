import './GroupsListingPage.scss';

import { ColorPicker, Flex, Space, Table, Tag, Typography } from 'antd';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { useListingDataQuery } from 'hooks/useListingQuery';
import { useTablePagination } from 'hooks/useTablePagination';
import { orderBy } from 'lodash';
import { Artist, Dictionary, Group } from 'types';

import { NewArtistDrawer } from './NewArtistDrawer';
import { NewGroupDrawer } from './NewGroupDrawer';
import { ArtistAvatar } from 'components/Artist';
import { useMemo } from 'react';

export function GroupsListingPage() {
  const groupsQuery = useListingDataQuery<Group>('groups');
  const artistsQuery = useListingDataQuery<Artist>('artists');
  // const groupsMutation = useGroupsMutation();
  const artists = artistsQuery.data?.data ?? {};

  const groups = Object.values(groupsQuery.data?.data ?? {});

  const paginationProps = useTablePagination({
    total: groups.length ?? 0,
  });

  if (groupsQuery.isLoading) {
    return <ContentLoading />;
  }

  if (groupsQuery.isError) {
    return <ContentError>{groupsQuery.error.message}</ContentError>;
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Size',
      dataIndex: 'artistsIds',
      key: 'size',
      render: (artistsIds: Group['artistsIds']) => Object.keys(artistsIds).length,
    },
    Table.EXPAND_COLUMN,
  ];

  return (
    <Content>
      <div className="header">
        <Typography.Title level={2}>Groups</Typography.Title>
        <Space>
          <NewGroupDrawer />
        </Space>
      </div>
      <Table
        dataSource={groups}
        columns={columns}
        rowKey="id"
        pagination={paginationProps}
        loading={groupsQuery.isLoading}
        expandable={{
          expandedRowRender: (record: Group) => <GroupArtists group={record} artists={artists} />,
        }}
      />
    </Content>
  );
}

type GroupArtistsProps = {
  group: Group;

  artists: Dictionary<Artist>;
};

function GroupArtists({ group, artists }: GroupArtistsProps) {
  const artistsList = useMemo(() => {
    return orderBy(Object.entries(group.artistsIds), ([, position]) => position).map(([id]) => artists[id]);
  }, [group.artistsIds, artists]);
  return (
    <div className="grid grid-cols-5 gap-2">
      {artistsList.map((artist) => {
        return (
          <Flex key={artist.id} className="surface" vertical>
            <Typography.Text copyable>{artist.id}</Typography.Text>
            <Typography.Text strong>{artist.name}</Typography.Text>
            <ArtistAvatar id={artist.id} name={artist.name} size={96} shape="square" />
            <div>
              <Tag>{artist.track}</Tag>
            </div>

            <Typography.Text copyable>{artist.color}</Typography.Text>
            <ColorPicker
              disabled
              value={artist.color}
              format="hex"
              showText={(color) => <span>{color.toHexString()}</span>}
            />
          </Flex>
        );
      })}
      <NewArtistDrawer group={group} />
    </div>
  );
}
