import { Button, Popconfirm, Select, Space } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import { useMemo, useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { UID } from 'types';
import { getLine, getSection } from 'utils/song';

type MoveLinesToSectionSelectorProps = {
  linesIds: UID[];
  onSuccess?: () => void;
};

export function MoveLinesToSectionSelector({ linesIds, onSuccess }: MoveLinesToSectionSelectorProps) {
  const { song } = useSongEditContext();
  const { onMoveLinesToSection } = useSongActions();
  const [targetSectionId, setTargetSectionId] = useState<UID | null>(null);

  const linesCommonSectionId = useMemo(() => {
    if (linesIds.length === 0) return null;

    const baseSectionId = getLine(linesIds[0], song).sectionId;
    return linesIds.every((lineId) => getLine(lineId, song).sectionId === baseSectionId)
      ? baseSectionId
      : null;
  }, [linesIds, song]);

  const options = useMemo(() => {
    return song.sectionIds.map((sectionId) => {
      const section = getSection(sectionId, song);
      return {
        label: `${section.kind} ${section.number}`,
        value: section.id,
      };
    });
  }, [song]);

  const anyNullSection = options.some((option) => option.label.includes('NULL'));

  return (
    <Space.Compact block>
      <Select
        defaultValue={linesCommonSectionId ?? undefined}
        options={options}
        onChange={(selectedOption) => {
          if (selectedOption) {
            setTargetSectionId(selectedOption);
          }
        }}
        disabled={anyNullSection}
        style={{ minWidth: 200, width: '100%' }}
      />
      <Popconfirm
        title="Are you sure you want to move these lines?"
        onConfirm={() => {
          if (targetSectionId) {
            onMoveLinesToSection(linesIds, targetSectionId);
            onSuccess?.();
          }
        }}
      >
        <Button type="primary" disabled={!targetSectionId || targetSectionId === linesCommonSectionId}>
          Move
        </Button>
      </Popconfirm>
    </Space.Compact>
  );
}
