import { DeleteOutlined } from '@ant-design/icons';
import { useLogSection } from '@hooks/useLogInstances';
import { useSongActions } from '@hooks/useSongActions';
import { useSongEditContext } from '@services/SongEditProvider';
import type { Song, SongSection, UID } from '@types';
import { distributor, getCompletionPercentage } from '@utils';
import { NULL, SECTION_KINDS } from '@utils/constants';
import {
  App,
  Button,
  Divider,
  Flex,
  Form,
  Input,
  Popconfirm,
  Progress,
  Select,
  Space,
  Typography,
} from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';

import { CriteriaRule } from './CriteriaRule';

const SECTION_KIND_OPTIONS = Object.values(SECTION_KINDS).map((skill) => ({ label: skill, value: skill }));

type EditSectionFormProps = {
  sectionId: UID;
  onClose: () => void;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function EditSectionForm({ sectionId, onClose, setDirty }: EditSectionFormProps) {
  const { song } = useSongEditContext();
  const { section } = useLogSection(sectionId, song);
  const { onUpdateSongContent, onDeleteSection } = useSongActions();
  const [tempSection, setTempSection] = useState<SongSection>(section);
  const { message } = App.useApp();

  const [form] = Form.useForm<SongSection>();
  const isDirty = form.isFieldsTouched();

  const criteria = {
    kind: tempSection.kind !== NULL,
    linesIds: tempSection.linesIds.length > 0,
  };

  const onValuesChange = (changedValues: Partial<SongSection>) => {
    setTempSection({ ...tempSection, ...changedValues });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies:a function shouldn't be part of this dependency
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty]);

  const onApplyChanges = () => {
    onUpdateSongContent(sectionId, tempSection);
    setDirty(false);
    onClose();
  };

  const onApplySuggestedKind = (kind: string) => {
    onUpdateSongContent(sectionId, { ...tempSection, kind });
    setDirty(false);
    onClose();
  };

  const [confirmDelete, setConfirmDelete] = useState('');

  return (
    <Form
      autoComplete="off"
      form={form}
      initialValues={tempSection}
      layout="vertical"
      name="edit-section-form"
      onFinish={onApplyChanges}
      onValuesChange={onValuesChange}
      preserve={false}
    >
      <Form.Item
        help={
          <KindSuggestions onApplySuggestedKind={onApplySuggestedKind} sectionId={sectionId} song={song} />
        }
        label="Kind"
        name="kind"
      >
        <Select options={SECTION_KIND_OPTIONS} />
      </Form.Item>

      <div className="grid grid-cols-2 gap-2">
        <Form.Item
          help="This number is automatically generated when locking the song."
          label="Number"
          name="number"
        >
          <Input disabled type="number" />
        </Form.Item>
        <Form.Item label="Lines count">
          <Input disabled value={tempSection.linesIds.length} />
        </Form.Item>
      </div>

      <Form.Item help={`Collection of lyrics from all lines (${tempSection.linesIds.length}).`} label="Lyric">
        <Input.TextArea autoSize={{ minRows: 1, maxRows: 6 }} disabled value={'...'} />
      </Form.Item>

      <Divider className="my-4" />

      <Space className="w-100" orientation="vertical" size="small">
        <Progress className="w-100" percent={getCompletionPercentage(Object.values(criteria))} />
        <CriteriaRule label="Has kind" value={criteria.kind} />
        <CriteriaRule label="Has lines" value={criteria.linesIds} />
      </Space>

      <Divider className="my-4" />

      <Form.Item help="Save before you delete a section since it might implode" label="" name="text">
        <Popconfirm
          description={
            <Flex>
              <Typography.Text>Type section id "{sectionId}" to confirm: </Typography.Text>
              <Input onChange={(e) => setConfirmDelete(e.target.value)} size="small" value={confirmDelete} />
            </Flex>
          }
          onConfirm={() => {
            if (confirmDelete === sectionId) {
              onDeleteSection(sectionId);
              onClose();
              setConfirmDelete('');
            } else {
              message.warning(`You must type the section id "${sectionId}" to confirm deletion.`);
            }
          }}
          title="Are you sure you want to delete this section?"
        >
          <Button block danger ghost icon={<DeleteOutlined />} type="primary">
            Delete This Section
          </Button>
        </Popconfirm>
      </Form.Item>

      <Divider />
      <Form.Item>
        <Flex gap={6}>
          <Button onClick={onClose}>Cancel</Button>
          <Button block disabled={!isDirty} htmlType="submit" type="primary">
            Apply Changes
          </Button>
        </Flex>
      </Form.Item>
    </Form>
  );
}

// Your updated dictionary, merged with the essential sequential mappings
const FALLBACK_SUGGESTIONS: Record<string, string[]> = {
  [SECTION_KINDS.INTRO]: [SECTION_KINDS.VERSE, SECTION_KINDS.HOOK],
  [SECTION_KINDS.VERSE]: [SECTION_KINDS.PRE_CHORUS, SECTION_KINDS.CHORUS], // The crucial link
  [SECTION_KINDS.PRE_CHORUS]: [SECTION_KINDS.CHORUS, SECTION_KINDS.DROP],
  [SECTION_KINDS.CHORUS]: [SECTION_KINDS.VERSE, SECTION_KINDS.POST_CHORUS, SECTION_KINDS.BRIDGE],
  [SECTION_KINDS.BRIDGE]: [SECTION_KINDS.CHORUS, SECTION_KINDS.INSTRUMENT_SOLO, SECTION_KINDS.OUTRO],
  [SECTION_KINDS.HOOK]: [SECTION_KINDS.VERSE, SECTION_KINDS.OUTRO],
  [SECTION_KINDS.POST_CHORUS]: [SECTION_KINDS.VERSE, SECTION_KINDS.BRIDGE],
  [SECTION_KINDS.DROP]: [SECTION_KINDS.CHORUS, SECTION_KINDS.BRIDGE],
  [SECTION_KINDS.BREAK]: [SECTION_KINDS.CHORUS, SECTION_KINDS.BRIDGE],
  [SECTION_KINDS.DANCE_BREAK]: [SECTION_KINDS.BRIDGE, SECTION_KINDS.CHORUS],
};

function getSmartSuggestions(song: Song, currentSectionId: UID): string[] {
  const sectionIds = song.sectionIds;
  const currentIndex = sectionIds.indexOf(currentSectionId);

  // Safety fallback if section isn't found
  if (currentIndex === -1) return [SECTION_KINDS.VERSE, SECTION_KINDS.PRE_CHORUS, SECTION_KINDS.CHORUS];

  const prevId = sectionIds[currentIndex - 1];
  const nextId = sectionIds[currentIndex + 1];

  const prevKind = prevId ? distributor.getSection(prevId, song).kind : null;
  const nextKind = nextId ? distributor.getSection(nextId, song).kind : null;

  const allKindsSoFar = sectionIds.map((id) => distributor.getSection(id, song).kind);
  const hasBridge = allKindsSoFar.includes(SECTION_KINDS.BRIDGE);

  const suggestions = new Set<string>();

  // 1. POSITIONAL CONTEXT (Highest Priority - appear first)
  if (currentIndex === 0) {
    suggestions.add(SECTION_KINDS.INTRO);
    suggestions.add(SECTION_KINDS.HOOK);
  }

  // 2. SANDWICH CONTEXT (Out-of-order inserts)
  if (prevKind === SECTION_KINDS.VERSE && nextKind === SECTION_KINDS.CHORUS) {
    suggestions.add(SECTION_KINDS.PRE_CHORUS);
  } else if (prevKind === SECTION_KINDS.CHORUS && nextKind === SECTION_KINDS.VERSE) {
    suggestions.add(SECTION_KINDS.POST_CHORUS);
    suggestions.add(SECTION_KINDS.INTERLUDE);
  }

  // 3. SEQUENTIAL FLOW (Handles the 90% linear workflow naturally)
  if (prevKind && FALLBACK_SUGGESTIONS[prevKind]) {
    FALLBACK_SUGGESTIONS[prevKind].forEach((k) => {
      suggestions.add(k);
    });
  }

  // 4. GLOBAL CONTEXT (Filling the gaps)
  if (currentIndex >= 3 && !hasBridge && prevKind !== SECTION_KINDS.BRIDGE) {
    suggestions.add(SECTION_KINDS.BRIDGE);
  }

  // 5. HARD RULES (The Safety Net)
  // Added last so they appear AFTER the smarter context suggestions.
  suggestions.add(SECTION_KINDS.CHORUS);

  const isDefinitiveEnding = prevKind === SECTION_KINDS.OUTRO || nextKind === SECTION_KINDS.OUTRO;
  if (!isDefinitiveEnding) {
    suggestions.add(SECTION_KINDS.VERSE);
  }

  // Return top 5 to make sure we have enough room for context + hard rules
  return Array.from(suggestions).slice(0, 5);
}

type KindSuggestionsProps = {
  onApplySuggestedKind: (kind: string) => void;
  sectionId: UID;
  song: Song;
};

export function KindSuggestions({ onApplySuggestedKind, sectionId, song }: KindSuggestionsProps) {
  const suggestions = useMemo(() => {
    return getSmartSuggestions(song, sectionId);
  }, [song, sectionId]);

  return (
    <Flex className="mt-1" gap={6} wrap="wrap">
      Suggestions:{' '}
      {suggestions.map((kind) => (
        <Button key={kind} onClick={() => onApplySuggestedKind(kind)} size="small" type="dashed">
          {kind}
        </Button>
      ))}
    </Flex>
  );
}
