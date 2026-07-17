import { ApiOutlined } from '@ant-design/icons';
import { ArtistAvatar } from '@components/Artist';
import { useSongDistributionContext } from '@services/SongDistributionProvider';
import type { Artist, Dictionary, SongPart, UID } from '@types';
import { distributor } from '@utils';
import { ALL_ID } from '@utils/constants';
import { App, Avatar, Button, Flex } from 'antd';
import clsx from 'clsx';
import { useState } from 'react';
import { LogLine } from './LogLine';
import { LogPart } from './LogPart';
import { LogSection } from './LogSection';

type LogProps = {
  className?: string;
};

export function DistributionLog({ className }: LogProps) {
  const { message, notification } = App.useApp();
  const {
    song,
    videoControls,
    activeAssignee,
    onAssign,
    onAssignMany,
    mapping,
    distribution: { assignees },
  } = useSongDistributionContext();

  const onPartClick = (partId: UID) => {
    onAssign(partId, activeAssignee);
  };

  const onLineClick = (lineId: UID) => {
    onAssignMany(distributor.getLine(lineId, song).partsIds, activeAssignee);
  };

  // Handler to assign all parts with recommendedAssignee 'G' to ALL
  const handleAssignGroupParts = () => {
    const groupPartIds = Object.entries(song.content)
      .filter(([, content]) => {
        // Check if it's a SongPart by checking for recommendedAssignee property
        return (content as SongPart).recommendedAssignee === 'G';
      })
      .map(([id]) => id);

    if (groupPartIds.length > 0) {
      onAssignMany(groupPartIds, ALL_ID);
    }
  };

  // Handler to assign 'none' parts with recommendedAssignee 'N' to NONE
  const handleAssignNoneParts = () => {
    const nonePartIds = Object.entries(song.content)
      .filter(([, content]) => {
        // Check if it's a SongPart by checking for recommendedAssignee property
        return (content as SongPart).recommendedAssignee === 'H';
      })
      .map(([id]) => id);

    if (nonePartIds.length > 0) {
      onAssignMany(nonePartIds, 'NONE');
    }
  };

  // Helper to check if all parts in a section are assigned
  const checkSectionCompletion = (sectionId: UID) => {
    const section = distributor.getSection(sectionId, song);
    const allLines = section.linesIds.map((lineId) => distributor.getLine(lineId, song));

    const allComplete = allLines.every((line) =>
      line.partsIds.every((partId) => mapping[partId] && mapping[partId].length > 0),
    );

    if (allComplete) {
      return 'complete';
    }

    // Detect partial
    const allRegularParts = allLines.flatMap((line) => (!line.adlib ? line.partsIds : []));

    const hasAssignedAllRegularParts = allRegularParts.every(
      (partId) => mapping[partId] && mapping[partId].length > 0,
    );

    if (allRegularParts.length > 0 && hasAssignedAllRegularParts) {
      return 'partial';
    }

    if (allRegularParts.length > 0) {
      return 'incomplete';
    }

    return false;
  };

  const [copiedSectionId, setCopiedSectionId] = useState<UID | null>(null);

  // Handle to copy section id to the internal clipboard

  const onSectionCopy = (sectionId: UID) => {
    setCopiedSectionId(sectionId);
    message.success(`Section ${sectionId} copied to clipboard`);
  };

  const onPasteSection = (sectionId: UID) => {
    if (!copiedSectionId) {
      notification.error({ title: 'No section copied to clipboard' });
      return;
    }
    if (copiedSectionId === sectionId) {
      notification.error({ title: 'Cannot paste a section assignees onto itself' });
      return;
    }

    const copiedSection = distributor.getSection(copiedSectionId, song);
    const targetSection = distributor.getSection(sectionId, song);
    if (copiedSection.kind !== targetSection.kind) {
      notification.error({ title: 'Cannot paste a section assignees onto a section of a different kind' });
      return;
    }

    // Get all regular (non-adlib) parts from copied section with their assignments
    const copiedParts = copiedSection.linesIds
      .flatMap((lineId) => {
        const line = distributor.getLine(lineId, song);
        return !line.adlib ? line.partsIds : [];
      })
      .map((partId) => ({
        partId,
        assignees: mapping[partId] || [],
      }));

    // Get all regular (non-adlib) parts from target section
    const targetParts = targetSection.linesIds.flatMap((lineId) => {
      const line = distributor.getLine(lineId, song);
      return !line.adlib ? line.partsIds : [];
    });

    // Check if sections have matching number of regular parts
    if (copiedParts.length !== targetParts.length) {
      // biome-ignore lint/suspicious/noConsole: debugging purposes
      console.warn(
        `Warning: Pasting section ${copiedSectionId} onto section ${sectionId} with different number of regular parts. Copied: ${copiedParts.length}, Target: ${targetParts.length}`,
      );
    }

    // Apply assignments from copied parts to target parts in order
    const minLength = Math.min(copiedParts.length, targetParts.length);
    const assigneeToPartsMap: Dictionary<UID[]> = {};

    for (let i = 0; i < minLength; i++) {
      const assignees = copiedParts[i].assignees;
      const targetPartId = targetParts[i];

      assignees.forEach((assigneeId) => {
        if (!assigneeToPartsMap[assigneeId]) {
          assigneeToPartsMap[assigneeId] = [];
        }
        assigneeToPartsMap[assigneeId].push(targetPartId);
      });
    }

    // Use onAssignMany for each assignee across all their target parts
    Object.entries(assigneeToPartsMap).forEach(([assigneeId, partIds]) => {
      onAssignMany(partIds, assigneeId);
    });

    message.success(`Pasted assignments from section ${copiedSectionId} to section ${sectionId}`);
  };

  return (
    <div className={clsx('log', 'surface', className)} key={song.updatedAt}>
      <Flex gap={6}>
        <Button onClick={handleAssignGroupParts} size="small">
          Assign Group Parts to ALL
        </Button>
        <Button onClick={handleAssignNoneParts} size="small">
          Assign None Parts to NONE
        </Button>
      </Flex>
      <ul className="log-sections">
        {song.sectionIds.map((sectionId) => (
          <LogSection
            id={sectionId}
            key={sectionId}
            onCopy={onSectionCopy}
            onPaste={copiedSectionId ? onPasteSection : undefined}
            onPlay={(startTime) => videoControls.seekAndPlay(startTime)}
            overrideComplete={checkSectionCompletion(sectionId)}
            song={song}
          >
            {distributor.getSection(sectionId, song).linesIds.map((lineId) => (
              <LogLine id={lineId} key={lineId} onApplyToLine={onLineClick} showPartsOnly song={song}>
                {distributor.getLine(lineId, song).partsIds.map((partId) => (
                  <LogPart
                    after={<PartAssignees assignees={assignees} mapping={mapping} partId={partId} />}
                    color="#d0d0d0"
                    hideStatusIcon
                    id={partId}
                    key={partId}
                    onClick={onPartClick}
                    song={song}
                  />
                ))}
              </LogLine>
            ))}
          </LogSection>
        ))}
      </ul>
    </div>
  );
}

type PartAssigneesProps = {
  mapping: Dictionary<UID[]>;
  partId: UID;
  assignees: Dictionary<Artist>;
};

function PartAssignees({ mapping, partId, assignees }: PartAssigneesProps) {
  if (!mapping[partId]) {
    return null;
  }

  if (mapping[partId].length === 0) {
    return <ApiOutlined />;
  }

  return (
    <Avatar.Group>
      {mapping[partId].map((assigneeId) => {
        const assignee = assignees?.[assigneeId];

        return (
          <ArtistAvatar
            id={assigneeId}
            key={assigneeId}
            name={assignees?.[assigneeId]?.name ?? assigneeId}
            size="small"
            style={{
              border: `2px solid ${assignee?.color ?? '#f1f1f1'}`,
            }}
          />
        );
      })}
    </Avatar.Group>
  );
}
