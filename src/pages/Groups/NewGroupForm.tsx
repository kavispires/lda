import { Button, Form, Input } from 'antd';
import { useAddListingEntryMutation } from 'hooks/useListingQuery';
import type { Group, ListingEntry } from 'types';
import { createGroup } from 'utils/groups';

type NewGroupFormFields = {
  name: string;
};

type NewGroupFormProps = {
  onClose: () => void;
};

export function NewGroupForm({ onClose }: NewGroupFormProps) {
  const { mutate: addGroupListingEntry, isPending } = useAddListingEntryMutation('groups');
  const [form] = Form.useForm<NewGroupFormFields>();

  const onFinish = (values: NewGroupFormFields) => {
    const newGroup = createGroup(values.name);
    const listingEntry: ListingEntry<Group> = {
      id: newGroup.id,
      name: newGroup.name,
      type: 'group',
      data: newGroup,
    };
    addGroupListingEntry(listingEntry, { onSuccess: onClose });
  };

  return (
    <Form form={form} layout="vertical" autoComplete="off" onFinish={onFinish}>
      <Form.Item label="Group name" name="name">
        <Input />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={isPending}>
          Add
        </Button>
      </Form.Item>
    </Form>
  );
}
