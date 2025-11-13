import './GroupsListingPage.scss';

import { ColorPicker, Flex, Space, Table, Tag, Typography } from 'antd';
import { ArtistAvatar } from 'components/Artist';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { useListingDataQuery } from 'hooks/useListingQuery';
import { useTablePagination } from 'hooks/useTablePagination';
import { orderBy } from 'lodash';
import { useMemo } from 'react';
import type { Artist, Dictionary, Group } from 'types';
import { NewArtistDrawer } from './NewArtistDrawer';
import { NewGroupDrawer } from './NewGroupDrawer';

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
        columns={columns}
        dataSource={groups}
        expandable={{
          expandedRowRender: (record: Group) => <GroupArtists artists={artists} group={record} />,
        }}
        loading={groupsQuery.isLoading}
        pagination={paginationProps}
        rowKey="id"
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
    <Flex gap={12} wrap>
      {artistsList.map((artist) => {
        return (
          <Flex className="surface" key={artist.id} vertical>
            <Typography.Text copyable>{artist.id}</Typography.Text>
            <Typography.Text strong>{artist.name}</Typography.Text>
            <ArtistAvatar id={artist.id} name={artist.name} shape="square" size={96} />
            <div>
              <Tag>{artist.track}</Tag>
            </div>

            <Typography.Text copyable>{artist.color}</Typography.Text>
            <ColorPicker
              disabled
              format="hex"
              showText={(color) => <span>{color.toHexString()}</span>}
              value={artist.color}
            />
          </Flex>
        );
      })}
      <NewArtistDrawer group={group} />
    </Flex>
  );
}
