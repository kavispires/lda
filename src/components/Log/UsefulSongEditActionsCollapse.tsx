import { InfoCircleOutlined } from '@ant-design/icons';
import { useSongEditContext } from '@services/SongEditProvider';
import { distributor } from '@utils';
import { Button, Collapse, type CollapseProps } from 'antd';
import { useState } from 'react';

export function UsefulSongEditActionsCollapse() {
  const [activePanel, setActivePanel] = useState<string[]>([]);
  const {
    selectionIdModel: { onDeselectAll },
  } = useSongEditContext();

  const items: CollapseProps['items'] = [
    {
      key: '1',
      label: 'Nudge Song',
      children: <div>{activePanel.includes('1') && <UsefulSongEditActionsCollapseContent />}</div>,
    },
  ];

  return (
    <Collapse
      activeKey={activePanel}
      expandIcon={() => <InfoCircleOutlined />}
      items={items}
      onChange={(keys) => {
        onDeselectAll();

        setActivePanel(keys);
      }}
      size="small"
    />
  );
}

function UsefulSongEditActionsCollapseContent() {
  const {
    song,
    selectionIdModel: { onSelectMany },
  } = useSongEditContext();

  // Handler for selecting all ad-libs candidates
  const handleSelectAll = () => {
    // Go through the songs lines and if the line's first part start with parenthesis, consider it an ad-lib candidate
    const adLibsLinesCandidatesIds: string[] = [];
    song.sectionIds.forEach((sectionId) => {
      distributor.getSectionSummary(sectionId, song).lines.forEach((line) => {
        const lineSummary = distributor.getLineSummary(line.id, song);
        if (lineSummary.text.startsWith('(')) {
          adLibsLinesCandidatesIds.push(line.id);
        }
      });
    });

    onSelectMany(adLibsLinesCandidatesIds);
  };

  return (
    <div>
      <Button onClick={handleSelectAll}>Select all ad-libs candidates</Button>
    </div>
  );
}
