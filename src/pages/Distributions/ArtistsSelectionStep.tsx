import { Button, Divider, Space, Typography } from 'antd';
import { ContentLoading } from 'components/Content';
import { useListingDataQuery } from 'hooks/useListingQuery';
import { Artist, Group } from 'types';

type ArtistsSelectionStepProps = {
  selectedArtists: Artist[];
  setSelectedArtists: React.Dispatch<React.SetStateAction<Artist[]>>;
  selectedGroup: Group | null;
  setSelectedGroup: React.Dispatch<React.SetStateAction<Group | null>>;
  onNextStep: () => void;
};

export function ArtistsSelectionStep({
  selectedArtists,
  setSelectedArtists,
  selectedGroup,
  setSelectedGroup,
  onNextStep,
}: ArtistsSelectionStepProps) {
  const groupsQuery = useListingDataQuery<Group>('groups');
  const artistsQuery = useListingDataQuery<Artist>('artists');
  // const groupsMutation = useGroupsMutation();
  const artists = artistsQuery.data?.data ?? {};

  if (groupsQuery.isLoading || artistsQuery.isLoading) {
    return <ContentLoading />;
  }

  const checkIsSelected = (artistId: string) => {
    return selectedArtists.some((artist) => artist.id === artistId);
  };

  const onSelectGroup = (group: Group) => {
    const isSelected = selectedGroup && group.id === selectedGroup.id;
    if (selectedGroup && group.id === selectedGroup.id) {
      setSelectedGroup(null);
    } else {
      setSelectedGroup(group);
    }

    if (isSelected) {
      setSelectedArtists((prev) =>
        prev.filter((artist) => !Object.keys(group.artistsIds).includes(artist.id))
      );
    } else {
      setSelectedArtists((prev) => [...prev, ...Object.keys(group.artistsIds).map((id) => artists[id])]);
    }
  };

  return (
    <div>
      <Typography.Paragraph>
        Select the artist you want part of this distribution, you can select an entire group or individual
        artists
      </Typography.Paragraph>

      <div>
        <Typography.Title level={5}>Groups</Typography.Title>

        <Space wrap>
          {groupsQuery?.data?.list.map((group) => {
            const isSelected = selectedGroup?.id === group.id;
            return (
              <Button
                key={group.id}
                onClick={() => onSelectGroup(group)}
                icon={isSelected ? <i className="fi fi-rr-check"></i> : <i className="fi fi-rr-users" />}
              >
                {group.name}
              </Button>
            );
          })}
        </Space>
      </div>

      <div>
        <Typography.Title level={5}>Groups</Typography.Title>

        <Space wrap>
          {artistsQuery.data?.list.map((artist) => {
            const isSelected = checkIsSelected(artist.id);
            return (
              <Button
                key={artist.id}
                onClick={() =>
                  setSelectedArtists((prev) =>
                    isSelected ? prev.filter((a) => a.id !== artist.id) : [...prev, artist]
                  )
                }
                icon={isSelected ? <i className="fi fi-rr-check"></i> : <i className="fi fi-rr-user" />}
              >
                {artist.name}
              </Button>
            );
          })}
        </Space>
      </div>

      <Divider />
      <Space>
        <Button type="primary" disabled={!selectedGroup} onClick={onNextStep}>
          Start Distribution
        </Button>
      </Space>
    </div>
  );
}
