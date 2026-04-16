import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SaveOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnType, TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import { DownloadButton } from 'components/Common/DownloadButton';
import { FirestoreConsoleLink } from 'components/Common/FirestoreConsoleLink';
import { Content } from 'components/Content';
import { useQueryParams } from 'hooks/useQueryParams';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContestantAvatar } from '../components/ContestantAvatar';
import { useContestantsParserMutation } from '../hooks/useContestants';
import { useContestantsContext } from '../services/ContestantsProvider';
import type { Contestant } from '../types/contestant';

type ContestantWithScore = Contestant & {
  score: number;
  incompleteCount: number;
  incompleteMissing: string[];
};

const calculateScore = (contestant: Contestant): number => {
  // Sum all core skills
  const trackSKills =
    (contestant.coreSkills?.vocals || 0) +
    (contestant.coreSkills?.rap || 0) +
    (contestant.coreSkills?.dance || 0);
  const stagePresenceSkill = contestant.coreSkills?.stagePresence || 0;
  const appearanceSkills =
    (contestant.coreSkills?.visual || 0) +
    (contestant.coreSkills?.uniqueness || 0) +
    (contestant.utilitySkills?.charisma || 0);

  const leadershipSkill = contestant.coreSkills?.leadership || 0;

  // Sum all utility skills
  const utilitySkillsTotal =
    (contestant.utilitySkills?.potential || 0) +
    (contestant.utilitySkills?.memory || 0) +
    (contestant.utilitySkills?.stamina || 0) +
    (contestant.utilitySkills?.learning || 0) +
    (contestant.utilitySkills?.acrobatics || 0) +
    (contestant.utilitySkills?.consistency || 0);

  // Calculate average
  return (
    (trackSKills * 4 +
      stagePresenceSkill * 5 +
      appearanceSkills * 2 +
      leadershipSkill * 1 +
      utilitySkillsTotal * 1) /
    (12 + 5 + 6 + 1 + 6)
  ); // Total weight is 30
};

const checkIncomplete = (contestant: Contestant): string[] => {
  const missing: string[] = [];

  // Check basic fields
  if (!contestant.name) missing.push('Name');
  if (!contestant.track) missing.push('Track');
  if (!contestant.color) missing.push('Color');
  // if (!contestant.persona) missing.push('Persona');

  // Check appearance
  if (!contestant.appearance?.age) missing.push('Age');
  if (!contestant.appearance?.hairStyle) missing.push('Hair Style');
  if (!contestant.appearance?.hairColor) missing.push('Hair Color');
  if (!contestant.appearance?.furColor) missing.push('Fur Color');

  // Check specialties
  if (!contestant.specialties?.vocalColor) missing.push('Vocal Color');
  if (!contestant.specialties?.danceStyle) missing.push('Dance Style');
  if (!contestant.specialties?.rapStyle) missing.push('Rap Style');
  if (!contestant.specialties?.visualVibe) missing.push('Visual Vibe');
  if (!contestant.specialties?.leadershipStyle) missing.push('Leadership Style');

  return missing;
};

// Column categories for the selector
const columnCategories = {
  core: {
    label: 'Core',
    columns: ['avatar', 'id', 'name', 'track'],
  },
  appearance: {
    label: 'Appearance',
    columns: ['age', 'height', 'build', 'hairStyle', 'hairColor', 'furColor'],
  },
  coreSkills: {
    label: 'Core Skills',
    columns: ['vocals', 'rap', 'dance', 'stagePresence', 'visual', 'uniqueness', 'leadership'],
  },
  utilitySkills: {
    label: 'Utility Skills',
    columns: ['potential', 'memory', 'stamina', 'learning', 'acrobatics', 'consistency', 'charisma'],
  },
  personality: {
    label: 'Personality',
    columns: [
      'discipline',
      'curiosity',
      'extroversion',
      'sensitivity',
      'gentleness',
      'sincerity',
      'ambition',
      'resilience',
      'maturity',
      'investment',
    ],
  },
  specialties: {
    label: 'Specialties',
    columns: ['vocalColor', 'danceStyle', 'rapStyle', 'visualVibe', 'leadershipStyle'],
  },
  status: {
    label: 'Status',
    columns: ['score', 'updatedAt', 'incomplete', 'actions'],
  },
};

// Column key to label mapping
const columnLabels: Record<string, string> = {
  avatar: 'Avatar',
  id: 'ID',
  name: 'Name',
  track: 'Track',
  age: 'Age',
  height: 'Height',
  build: 'Build',
  hairStyle: 'Hair Style',
  hairColor: 'Hair Color',
  furColor: 'Fur Color',
  vocals: 'Vocals',
  rap: 'Rap',
  dance: 'Dance',
  stagePresence: 'Stage Presence',
  visual: 'Visual',
  uniqueness: 'Uniqueness',
  leadership: 'Leadership',
  potential: 'Potential',
  memory: 'Memory',
  stamina: 'Stamina',
  learning: 'Learning',
  acrobatics: 'Acrobatics',
  consistency: 'Consistency',
  charisma: 'Charisma',
  discipline: 'Discipline',
  curiosity: 'Curiosity',
  extroversion: 'Extroversion',
  sensitivity: 'Sensitivity',
  gentleness: 'Gentleness',
  sincerity: 'Sincerity',
  ambition: 'Ambition',
  resilience: 'Resilience',
  maturity: 'Maturity',
  investment: 'Investment',
  vocalColor: 'Vocal Color',
  danceStyle: 'Dance Style',
  rapStyle: 'Rap Style',
  visualVibe: 'Visual Vibe',
  leadershipStyle: 'Leadership Style',
  score: 'Score',
  updatedAt: 'Updated',
  incomplete: 'Incomplete',
  actions: 'Actions',
};

export function TheSearchPage() {
  const navigate = useNavigate();
  const { queryParams, addParams } = useQueryParams();
  const [searchQuery, setSearchQuery] = useState('');
  const parserMutation = useContestantsParserMutation();
  const {
    contestants: contestantsData,
    deleteLocalContestant,
    hasDirtyChanges,
    dirtyCount,
    saveAll,
    isSaving,
    discardChanges,
  } = useContestantsContext();

  // Initialize table state from query params and localStorage
  const [currentPage, setCurrentPage] = useState(() => {
    const page = queryParams.get('page');
    return page ? Number(page) : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const size = queryParams.get('pageSize');
    return size ? Number(size) : 20;
  });
  const [filteredTracks, setFilteredTracks] = useState<string[]>(() => {
    const tracks = queryParams.get('tracks');
    return tracks ? tracks.split(',') : [];
  });

  // Sorting state - load from localStorage
  const [sortField, setSortField] = useState<string | undefined>(() => {
    const saved = localStorage.getItem('the-search-sort-field');
    return saved || 'updatedAt';
  });
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | undefined>(() => {
    const saved = localStorage.getItem('the-search-sort-order');
    return (saved === 'ascend' || saved === 'descend' ? saved : 'descend') as
      | 'ascend'
      | 'descend'
      | undefined;
  });

  // Column visibility state - load from localStorage
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('the-search-visible-columns');
    if (saved) {
      return new Set(JSON.parse(saved));
    }
    // Default visible columns
    return new Set(['avatar', 'id', 'name', 'track', 'score', 'updatedAt', 'incomplete', 'actions']);
  });

  // Save visible columns to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('the-search-visible-columns', JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  // Save sorting to localStorage whenever it changes
  useEffect(() => {
    if (sortField) {
      localStorage.setItem('the-search-sort-field', sortField);
    }
  }, [sortField]);

  useEffect(() => {
    if (sortOrder) {
      localStorage.setItem('the-search-sort-order', sortOrder);
    }
  }, [sortOrder]);

  const toggleColumn = (columnKey: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  // Sync pagination and filters with query params when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const page = queryParams.get('page');
    const size = queryParams.get('pageSize');
    const tracks = queryParams.get('tracks');

    setCurrentPage(page ? Number(page) : 1);
    setPageSize(size ? Number(size) : 20);
    setFilteredTracks(tracks ? tracks.split(',') : []);
  }, [queryParams]);

  const contestants = contestantsData ? Object.values(contestantsData) : [];

  // Filter contestants based on search query and track filters
  const filteredContestants = contestants.filter((contestant) => {
    // Apply track filter
    if (filteredTracks.length > 0 && !filteredTracks.includes(contestant.track)) {
      return false;
    }

    // Apply search query
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    // Search in id, name, persona
    if (
      contestant.id.toLowerCase().includes(query) ||
      contestant.name.toLowerCase().includes(query) ||
      contestant.persona?.toLowerCase().includes(query)
    ) {
      return true;
    }

    // Search in personality values
    if (contestant.personality) {
      const personalityValues = [
        contestant.personality.discipline?.toString(),
        contestant.personality.curiosity?.toString(),
        contestant.personality.extroversion?.toString(),
        contestant.personality.sensitivity?.toString(),
        contestant.personality.gentleness?.toString(),
        contestant.personality.sincerity?.toString(),
        contestant.personality.ambition?.toString(),
        contestant.personality.resilience?.toString(),
        contestant.personality.maturity?.toString(),
        contestant.personality.investment?.toString(),
      ];

      if (personalityValues.some((value) => value?.toLowerCase().includes(query))) {
        return true;
      }
    }

    return false;
  });

  // Pre-calculate scores and incomplete data for all filtered contestants
  const contestantsWithScores = useMemo(() => {
    return filteredContestants.map((contestant) => {
      const missing = checkIncomplete(contestant);
      return {
        ...contestant,
        score: calculateScore(contestant),
        incompleteCount: missing.length,
        incompleteMissing: missing,
      };
    });
  }, [filteredContestants]);

  // Handle table changes (pagination, filters, sorting)
  const handleTableChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<ContestantWithScore> | SorterResult<ContestantWithScore>[],
  ) => {
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const trackFilter = filters.track as string[] | null;

    // Use columnKey for sorting since it's always a string (field can be an array for nested dataIndex)
    const sortFieldValue = (singleSorter.columnKey as string | undefined) || undefined;

    // Update local state
    setCurrentPage(pagination.current || 1);
    setPageSize(pagination.pageSize || 20);
    setSortField(sortFieldValue);
    setSortOrder(singleSorter.order === null ? undefined : singleSorter.order);
    setFilteredTracks(trackFilter || []);

    // Update query params (pagination and filters only, sorting is in localStorage)
    const params: Record<string, unknown> = {};
    const defaults: Record<string, unknown> = {
      page: 1,
      pageSize: 20,
      tracks: '',
    };

    params.page = pagination.current || 1;
    params.pageSize = pagination.pageSize || 20;
    params.tracks = trackFilter && trackFilter.length > 0 ? trackFilter.join(',') : '';

    addParams(params, defaults);
  };

  // Define all possible columns
  const allColumns: ColumnType<ContestantWithScore>[] = [
    // Core columns
    {
      title: 'Avatar',
      dataIndex: 'id',
      key: 'avatar',
      width: 80,
      render: (id: string, record: Contestant) => <ContestantAvatar id={id} name={record.name} size={48} />,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]),
      sortOrder: sortField === 'id' ? sortOrder : undefined,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      sortOrder: sortField === 'name' ? sortOrder : undefined,
    },
    {
      title: 'Track',
      dataIndex: 'track',
      key: 'track',
      render: (track: string, record: Contestant) => (
        <Space align="center" size="small">
          <Tooltip title={record.color}>
            <div
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: record.color || '#FFFFFF',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
              }}
            />
          </Tooltip>
          <Tag>{track}</Tag>
        </Space>
      ),
      filters: [
        { text: 'Vocal', value: 'VOCAL' },
        { text: 'Rap', value: 'RAP' },
        { text: 'Dance', value: 'DANCE' },
      ],
      filteredValue: filteredTracks.length > 0 ? filteredTracks : null,
      onFilter: (value, record) => record.track === value,
    },
    // Appearance columns
    {
      title: 'Age',
      dataIndex: ['appearance', 'age'],
      key: 'age',
      width: 60,
      sorter: (a, b) => (a.appearance?.age || 0) - (b.appearance?.age || 0),
      sortOrder: sortField === 'age' ? sortOrder : undefined,
    },
    {
      title: 'Height',
      dataIndex: ['appearance', 'height'],
      key: 'height',
      render: (height?: string) => height || '-',
      sorter: (a, b) => (a.appearance?.height || '').localeCompare(b.appearance?.height || ''),
      sortOrder: sortField === 'height' ? sortOrder : undefined,
    },
    {
      title: 'Build',
      dataIndex: ['appearance', 'build'],
      key: 'build',
      render: (build?: string) => build || '-',
      sorter: (a, b) => (a.appearance?.build || '').localeCompare(b.appearance?.build || ''),
      sortOrder: sortField === 'build' ? sortOrder : undefined,
    },
    {
      title: 'Hair Style',
      dataIndex: ['appearance', 'hairStyle'],
      key: 'hairStyle',
      render: (hairStyle?: string) => hairStyle || '-',
      sorter: (a, b) => (a.appearance?.hairStyle || '').localeCompare(b.appearance?.hairStyle || ''),
      sortOrder: sortField === 'hairStyle' ? sortOrder : undefined,
    },
    {
      title: 'Hair Color',
      dataIndex: ['appearance', 'hairColor'],
      key: 'hairColor',
      render: (hairColor?: string) => hairColor || '-',
      sorter: (a, b) => (a.appearance?.hairColor || '').localeCompare(b.appearance?.hairColor || ''),
      sortOrder: sortField === 'hairColor' ? sortOrder : undefined,
    },
    {
      title: 'Fur Color',
      dataIndex: ['appearance', 'furColor'],
      key: 'furColor',
      render: (furColor?: string) => furColor || '-',
      sorter: (a, b) => (a.appearance?.furColor || '').localeCompare(b.appearance?.furColor || ''),
      sortOrder: sortField === 'furColor' ? sortOrder : undefined,
    },
    // Core Skills
    {
      title: 'Vocals',
      dataIndex: ['coreSkills', 'vocals'],
      key: 'vocals',
      width: 70,
      sorter: (a, b) => (a.coreSkills?.vocals || 0) - (b.coreSkills?.vocals || 0),
      sortOrder: sortField === 'vocals' ? sortOrder : undefined,
    },
    {
      title: 'Rap',
      dataIndex: ['coreSkills', 'rap'],
      key: 'rap',
      width: 60,
      sorter: (a, b) => (a.coreSkills?.rap || 0) - (b.coreSkills?.rap || 0),
      sortOrder: sortField === 'rap' ? sortOrder : undefined,
    },
    {
      title: 'Dance',
      dataIndex: ['coreSkills', 'dance'],
      key: 'dance',
      width: 70,
      sorter: (a, b) => (a.coreSkills?.dance || 0) - (b.coreSkills?.dance || 0),
      sortOrder: sortField === 'dance' ? sortOrder : undefined,
    },
    {
      title: 'Stage Presence',
      dataIndex: ['coreSkills', 'stagePresence'],
      key: 'stagePresence',
      width: 80,
      sorter: (a, b) => (a.coreSkills?.stagePresence || 0) - (b.coreSkills?.stagePresence || 0),
      sortOrder: sortField === 'stagePresence' ? sortOrder : undefined,
    },
    {
      title: 'Visual',
      dataIndex: ['coreSkills', 'visual'],
      key: 'visual',
      width: 70,
      sorter: (a, b) => (a.coreSkills?.visual || 0) - (b.coreSkills?.visual || 0),
      sortOrder: sortField === 'visual' ? sortOrder : undefined,
    },
    {
      title: 'Uniqueness',
      dataIndex: ['coreSkills', 'uniqueness'],
      key: 'uniqueness',
      width: 80,
      sorter: (a, b) => (a.coreSkills?.uniqueness || 0) - (b.coreSkills?.uniqueness || 0),
      sortOrder: sortField === 'uniqueness' ? sortOrder : undefined,
    },
    {
      title: 'Leadership',
      dataIndex: ['coreSkills', 'leadership'],
      key: 'leadership',
      width: 80,
      sorter: (a, b) => (a.coreSkills?.leadership || 0) - (b.coreSkills?.leadership || 0),
      sortOrder: sortField === 'leadership' ? sortOrder : undefined,
    },
    // Utility Skills
    {
      title: 'Potential',
      dataIndex: ['utilitySkills', 'potential'],
      key: 'potential',
      width: 80,
      sorter: (a, b) => (a.utilitySkills?.potential || 0) - (b.utilitySkills?.potential || 0),
      sortOrder: sortField === 'potential' ? sortOrder : undefined,
    },
    {
      title: 'Memory',
      dataIndex: ['utilitySkills', 'memory'],
      key: 'memory',
      width: 80,
      sorter: (a, b) => (a.utilitySkills?.memory || 0) - (b.utilitySkills?.memory || 0),
      sortOrder: sortField === 'memory' ? sortOrder : undefined,
    },
    {
      title: 'Stamina',
      dataIndex: ['utilitySkills', 'stamina'],
      key: 'stamina',
      width: 80,
      sorter: (a, b) => (a.utilitySkills?.stamina || 0) - (b.utilitySkills?.stamina || 0),
      sortOrder: sortField === 'stamina' ? sortOrder : undefined,
    },
    {
      title: 'Learning',
      dataIndex: ['utilitySkills', 'learning'],
      key: 'learning',
      width: 80,
      sorter: (a, b) => (a.utilitySkills?.learning || 0) - (b.utilitySkills?.learning || 0),
      sortOrder: sortField === 'learning' ? sortOrder : undefined,
    },
    {
      title: 'Acrobatics',
      dataIndex: ['utilitySkills', 'acrobatics'],
      key: 'acrobatics',
      width: 80,
      sorter: (a, b) => (a.utilitySkills?.acrobatics || 0) - (b.utilitySkills?.acrobatics || 0),
      sortOrder: sortField === 'acrobatics' ? sortOrder : undefined,
    },
    {
      title: 'Consistency',
      dataIndex: ['utilitySkills', 'consistency'],
      key: 'consistency',
      width: 80,
      sorter: (a, b) => (a.utilitySkills?.consistency || 0) - (b.utilitySkills?.consistency || 0),
      sortOrder: sortField === 'consistency' ? sortOrder : undefined,
    },
    {
      title: 'Charisma',
      dataIndex: ['utilitySkills', 'charisma'],
      key: 'charisma',
      width: 80,
      sorter: (a, b) => (a.utilitySkills?.charisma || 0) - (b.utilitySkills?.charisma || 0),
      sortOrder: sortField === 'charisma' ? sortOrder : undefined,
    },
    // Personality Traits
    {
      title: 'Discipline',
      dataIndex: ['personality', 'discipline'],
      key: 'discipline',
      width: 80,
      sorter: (a, b) => (a.personality?.discipline || 0) - (b.personality?.discipline || 0),
      sortOrder: sortField === 'discipline' ? sortOrder : undefined,
    },
    {
      title: 'Curiosity',
      dataIndex: ['personality', 'curiosity'],
      key: 'curiosity',
      width: 80,
      sorter: (a, b) => (a.personality?.curiosity || 0) - (b.personality?.curiosity || 0),
      sortOrder: sortField === 'curiosity' ? sortOrder : undefined,
    },
    {
      title: 'Extroversion',
      dataIndex: ['personality', 'extroversion'],
      key: 'extroversion',
      width: 80,
      sorter: (a, b) => (a.personality?.extroversion || 0) - (b.personality?.extroversion || 0),
      sortOrder: sortField === 'extroversion' ? sortOrder : undefined,
    },
    {
      title: 'Sensitivity',
      dataIndex: ['personality', 'sensitivity'],
      key: 'sensitivity',
      width: 80,
      sorter: (a, b) => (a.personality?.sensitivity || 0) - (b.personality?.sensitivity || 0),
      sortOrder: sortField === 'sensitivity' ? sortOrder : undefined,
    },
    {
      title: 'Gentleness',
      dataIndex: ['personality', 'gentleness'],
      key: 'gentleness',
      width: 80,
      sorter: (a, b) => (a.personality?.gentleness || 0) - (b.personality?.gentleness || 0),
      sortOrder: sortField === 'gentleness' ? sortOrder : undefined,
    },
    {
      title: 'Sincerity',
      dataIndex: ['personality', 'sincerity'],
      key: 'sincerity',
      width: 80,
      sorter: (a, b) => (a.personality?.sincerity || 0) - (b.personality?.sincerity || 0),
      sortOrder: sortField === 'sincerity' ? sortOrder : undefined,
    },
    {
      title: 'Ambition',
      dataIndex: ['personality', 'ambition'],
      key: 'ambition',
      width: 80,
      sorter: (a, b) => (a.personality?.ambition || 0) - (b.personality?.ambition || 0),
      sortOrder: sortField === 'ambition' ? sortOrder : undefined,
    },
    {
      title: 'Resilience',
      dataIndex: ['personality', 'resilience'],
      key: 'resilience',
      width: 80,
      sorter: (a, b) => (a.personality?.resilience || 0) - (b.personality?.resilience || 0),
      sortOrder: sortField === 'resilience' ? sortOrder : undefined,
    },
    {
      title: 'Maturity',
      dataIndex: ['personality', 'maturity'],
      key: 'maturity',
      width: 80,
      sorter: (a, b) => (a.personality?.maturity || 0) - (b.personality?.maturity || 0),
      sortOrder: sortField === 'maturity' ? sortOrder : undefined,
    },
    {
      title: 'Investment',
      dataIndex: ['personality', 'investment'],
      key: 'investment',
      width: 80,
      sorter: (a, b) => (a.personality?.investment || 0) - (b.personality?.investment || 0),
      sortOrder: sortField === 'investment' ? sortOrder : undefined,
    },
    // Specialties
    {
      title: 'Vocal Color',
      dataIndex: ['specialties', 'vocalColor'],
      key: 'vocalColor',
      render: (value?: string) => value || '-',
      sorter: (a, b) => (a.specialties?.vocalColor || '').localeCompare(b.specialties?.vocalColor || ''),
      sortOrder: sortField === 'vocalColor' ? sortOrder : undefined,
    },
    {
      title: 'Dance Style',
      dataIndex: ['specialties', 'danceStyle'],
      key: 'danceStyle',
      render: (value?: string) => value || '-',
      sorter: (a, b) => (a.specialties?.danceStyle || '').localeCompare(b.specialties?.danceStyle || ''),
      sortOrder: sortField === 'danceStyle' ? sortOrder : undefined,
    },
    {
      title: 'Rap Style',
      dataIndex: ['specialties', 'rapStyle'],
      key: 'rapStyle',
      render: (value?: string) => value || '-',
      sorter: (a, b) => (a.specialties?.rapStyle || '').localeCompare(b.specialties?.rapStyle || ''),
      sortOrder: sortField === 'rapStyle' ? sortOrder : undefined,
    },
    {
      title: 'Visual Vibe',
      dataIndex: ['specialties', 'visualVibe'],
      key: 'visualVibe',
      render: (value?: string) => value || '-',
      sorter: (a, b) => (a.specialties?.visualVibe || '').localeCompare(b.specialties?.visualVibe || ''),
      sortOrder: sortField === 'visualVibe' ? sortOrder : undefined,
    },
    {
      title: 'Leadership Style',
      dataIndex: ['specialties', 'leadershipStyle'],
      key: 'leadershipStyle',
      render: (value?: string) => value || '-',
      sorter: (a, b) =>
        (a.specialties?.leadershipStyle || '').localeCompare(b.specialties?.leadershipStyle || ''),
      sortOrder: sortField === 'leadershipStyle' ? sortOrder : undefined,
    },
    // Calculated/Status columns
    {
      title: 'Score',
      key: 'score',
      width: 80,
      sorter: (a, b) => a.score - b.score,
      sortOrder: sortField === 'score' ? sortOrder : undefined,
      render: (_value: unknown, record: ContestantWithScore) => record.score.toFixed(2),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: (a, b) => (a.updatedAt || 0) - (b.updatedAt || 0),
      sortOrder: sortField === 'updatedAt' ? sortOrder : undefined,
      render: (timestamp: number) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    {
      title: <WarningOutlined />,
      key: 'incomplete',
      width: 60,
      align: 'center',
      sorter: (a, b) => a.incompleteCount - b.incompleteCount,
      sortOrder: sortField === 'incomplete' ? sortOrder : undefined,
      render: (_value: unknown, record: ContestantWithScore) => {
        if (record.incompleteCount === 0) return null;
        return (
          <Tooltip title={`Missing: ${record.incompleteMissing.join(', ')}`}>
            <WarningOutlined style={{ color: '#faad14', fontSize: '16px' }} />
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_value: unknown, record: Contestant) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/the-search/edit?id=${record.id}`)}
            size="small"
            type="link"
          >
            Edit
          </Button>
          <Popconfirm
            cancelText="No"
            okText="Yes"
            onConfirm={() => deleteLocalContestant(record.id)}
            title="Delete this contestant?"
          >
            <Button danger icon={<DeleteOutlined />} size="small" type="link">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key as string));

  const columnSelectorMenu = (
    <Card
      style={{
        padding: '8px',
        maxWidth: '600px',
        maxHeight: '60vh',
        overflow: 'auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      {Object.entries(columnCategories).map(([key, category]) => (
        <div key={key} style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{category.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {category.columns.map((colKey) => (
              <Checkbox
                checked={visibleColumns.has(colKey)}
                key={colKey}
                onChange={() => toggleColumn(colKey)}
                style={{ margin: 0 }}
              >
                {columnLabels[colKey] || colKey}
              </Checkbox>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );

  return (
    <Content>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <Typography.Title level={2}>The Search - Contestants</Typography.Title>
        <Space>
          {hasDirtyChanges && (
            <>
              <Popconfirm
                cancelText="No"
                okText="Yes, Discard"
                onConfirm={discardChanges}
                title="Discard all unsaved changes?"
              >
                <Button size="large">
                  Discard {dirtyCount} Change{dirtyCount > 1 ? 's' : ''}
                </Button>
              </Popconfirm>
              <Button
                danger
                icon={<SaveOutlined />}
                loading={isSaving}
                onClick={() => saveAll()}
                size="large"
                type="primary"
              >
                Save {dirtyCount} Change{dirtyCount > 1 ? 's' : ''}
              </Button>
            </>
          )}
          <Button
            disabled
            icon={<PlusOutlined />}
            onClick={() => navigate('/the-search/new')}
            type={hasDirtyChanges ? 'default' : 'primary'}
          >
            New Contestant
          </Button>
          {/* Utility parser for one-time data migrations */}
          <Button
            danger
            disabled
            loading={parserMutation.isPending}
            onClick={() => parserMutation.mutate(contestantsData)}
          >
            🛠️ Run Parser
          </Button>
          <DownloadButton data={contestantsData || {}} fileName="contestants.json">
            Download Data
          </DownloadButton>
        </Space>
      </div>

      <Typography.Paragraph>
        Manage contestants for The Search survival show simulation. Total contestants: {contestants.length}
        {' | '}
        <FirestoreConsoleLink label="Open in Firestore Console" path="/contestants" />
      </Typography.Paragraph>

      <Flex align="center" gap={8} style={{ marginBottom: '1rem' }}>
        <Input.Search
          allowClear
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by ID, name, persona, or personality values..."
          size="large"
          value={searchQuery}
        />

        <Dropdown popupRender={() => columnSelectorMenu} trigger={['click']}>
          <Button icon={<EyeOutlined />} size="large">
            Columns
          </Button>
        </Dropdown>
      </Flex>

      <Table
        columns={columns}
        dataSource={contestantsWithScores}
        onChange={handleTableChange}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          showSizeChanger: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} contestants${searchQuery ? ' (filtered)' : ''}`,
        }}
        rowKey="id"
      />
    </Content>
  );
}
