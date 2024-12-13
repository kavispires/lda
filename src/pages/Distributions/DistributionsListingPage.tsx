// import './GroupsListingPage.scss';

import { Button, Select, Space, Table, Typography } from 'antd';
import { Content, ContentError, ContentLoading } from 'components/Content';
import { useListingQuery } from 'hooks/useListingQuery';
import { useQueryParams } from 'hooks/useQueryParams';
import { useTablePagination } from 'hooks/useTablePagination';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListingEntry } from 'types';

const ALL_GROUPS = 'All Groups';

export function DistributionsListingPage() {
  const distributionsQuery = useListingQuery('distributions');
  const navigate = useNavigate();
  const { queryParams, addParam } = useQueryParams();
  const list = useMemo(() => distributionsQuery.data?.list ?? [], [distributionsQuery.data]);

  const groupsSelectOptions = useMemo(() => {
    const optionsArr = list.reduce(
      (acc: any[], listingEntry) => {
        const [groupName] = listingEntry.name.split(' - ');
        return acc.includes(groupName) ? acc : [...acc, groupName];
      },
      [ALL_GROUPS]
    );
    return optionsArr.map((option) => ({ label: option, value: option }));
  }, [list]);

  const activeGroup = queryParams.get('group') ?? ALL_GROUPS;

  const currentList = useMemo(() => {
    if (activeGroup === ALL_GROUPS) {
      return list;
    }

    return list.filter((listingEntry) => listingEntry.name.startsWith(activeGroup));
  }, [list, activeGroup]);

  const paginationProps = useTablePagination({ total: currentList?.length ?? 0, resetter: activeGroup });

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
      <Select
        options={groupsSelectOptions}
        onChange={(value) => addParam('group', value)}
        value={activeGroup}
        style={{ minWidth: 200 }}
        className="mb-2"
      />
      <Table
        dataSource={currentList}
        columns={columns}
        rowKey="id"
        pagination={paginationProps}
        loading={distributionsQuery.isLoading}
      />
    </Content>
  );
}
