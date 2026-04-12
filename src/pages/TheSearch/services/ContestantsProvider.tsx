import { App } from 'antd';
import { deleteField } from 'firebase/firestore';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useIdle } from 'react-use';
import { updateDocQueryFunction } from 'services/firebase';
import type { Contestant } from '../types/contestant';
import { serializeContestant } from '../utilities/serialization';

interface ContestantsContextValue {
  contestants: Record<string, Contestant>;
  dirtyIds: Set<string>;
  isSaving: boolean;
  updateLocalContestant: (contestant: Contestant) => void;
  deleteLocalContestant: (id: string) => void;
  saveAll: (options?: { suppressNotification?: boolean }) => Promise<void>;
  discardChanges: () => void;
  hasDirtyChanges: boolean;
  dirtyCount: number;
}

const ContestantsContext = createContext<ContestantsContextValue | null>(null);

interface ContestantsProviderProps {
  children: ReactNode;
  initialData: Record<string, Contestant>;
}

export function ContestantsProvider({ children, initialData }: ContestantsProviderProps) {
  const { notification } = App.useApp();

  const [contestants, setContestants] = useState<Record<string, Contestant>>(initialData);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Track if user is idle for 3 minutes (180000ms)
  const isIdle = useIdle(3 * 60 * 1000);
  const hasAutoSavedRef = useRef(false);

  // Sync with initial data when it changes (e.g., after save)
  useEffect(() => {
    setContestants(initialData);
  }, [initialData]);

  const updateLocalContestant = useCallback((contestant: Contestant) => {
    setContestants((prev) => ({
      ...prev,
      [contestant.id]: contestant,
    }));
    setDirtyIds((prev) => new Set(prev).add(contestant.id));
  }, []);

  const deleteLocalContestant = useCallback((id: string) => {
    setDeletedIds((prev) => new Set(prev).add(id));
    setDirtyIds((prev) => new Set(prev).add(id));
  }, []);

  const saveAll = useCallback(
    async (options?: { suppressNotification?: boolean }) => {
      if (dirtyIds.size === 0 && deletedIds.size === 0) return;

      setIsSaving(true);
      try {
        const updates: Record<string, string | ReturnType<typeof deleteField>> = {};

        // Updates for modified contestants
        for (const id of dirtyIds) {
          if (!deletedIds.has(id)) {
            const contestant = contestants[id];
            if (contestant) {
              const withTimestamp = { ...contestant, updatedAt: Date.now() };
              updates[id] = serializeContestant(withTimestamp);
              // Update local state with timestamp
              setContestants((prev) => ({ ...prev, [id]: withTimestamp }));
            }
          }
        }

        // Deletions
        for (const id of deletedIds) {
          updates[id] = deleteField();
          // Remove from local state
          setContestants((prev) => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
          });
        }

        // Batch update to Firestore
        await updateDocQueryFunction('the-search', 'contestants', updates);

        if (!options?.suppressNotification) {
          notification.success({
            message: 'Saved Successfully',
            description: `${dirtyIds.size} contestant${dirtyIds.size > 1 ? 's' : ''} saved to database`,
          });
        }

        // Clear dirty state
        setDirtyIds(new Set());
        setDeletedIds(new Set());
      } catch (error) {
        notification.error({
          message: 'Save Failed',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [dirtyIds, deletedIds, contestants, notification],
  );

  const discardChanges = useCallback(() => {
    setContestants(initialData);
    setDirtyIds(new Set());
    setDeletedIds(new Set());
    notification.info({
      message: 'Changes Discarded',
      description: 'All changes have been reverted to saved state',
    });
  }, [initialData, notification]);

  // Auto-save when user is idle for 3 minutes and there are unsaved changes
  useEffect(() => {
    const hasDirtyChanges = dirtyIds.size > 0 || deletedIds.size > 0;

    if (isIdle && hasDirtyChanges && !isSaving && !hasAutoSavedRef.current) {
      hasAutoSavedRef.current = true;
      const changeCount = dirtyIds.size + deletedIds.size;
      saveAll({ suppressNotification: true }).then(() => {
        notification.info({
          message: 'Auto-saved',
          description: `${changeCount} change${changeCount > 1 ? 's' : ''} automatically saved after 3 minutes of inactivity`,
          duration: 5,
        });
      });
    }

    // Reset auto-save flag when user becomes active again
    if (!isIdle) {
      hasAutoSavedRef.current = false;
    }
  }, [isIdle, dirtyIds.size, deletedIds.size, isSaving, saveAll, notification]);

  const value = useMemo<ContestantsContextValue>(
    () => ({
      contestants,
      dirtyIds,
      isSaving,
      updateLocalContestant,
      deleteLocalContestant,
      saveAll,
      discardChanges,
      hasDirtyChanges: dirtyIds.size > 0 || deletedIds.size > 0,
      dirtyCount: dirtyIds.size + deletedIds.size,
    }),
    [
      contestants,
      dirtyIds,
      deletedIds,
      isSaving,
      updateLocalContestant,
      deleteLocalContestant,
      saveAll,
      discardChanges,
    ],
  );

  return <ContestantsContext.Provider value={value}>{children}</ContestantsContext.Provider>;
}

export function useContestantsContext() {
  const context = useContext(ContestantsContext);
  if (!context) {
    throw new Error('useContestantsContext must be used within ContestantsProvider');
  }
  return context;
}
