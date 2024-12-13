import { ContentError, ContentLoading } from 'components/Content';
import { useSelectionIdModel } from 'hooks/useSelectionIdModel';
import { useSongMutation, useSongQuery } from 'hooks/useSong';
import { UseStep, useStep } from 'hooks/useStep';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Song } from 'types';
import { distributor } from 'utils';

type SongEditContextType = {
  stepper: UseStep;
  selectionIdModel: ReturnType<typeof useSelectionIdModel>;
  song: Song;
  setSong: React.Dispatch<React.SetStateAction<Song | null>>;
  updateSong: (updatedSong: Partial<Song>) => void;
  saveSong: () => void;
  isSaving: boolean;
  isReady: boolean;
  isDirty: boolean;
};

const SongEditContext = createContext<SongEditContextType | undefined>(undefined);

export const SongEditProvider = ({ children }: PropsWithChildren) => {
  const { songId } = useParams();
  const stepper = useStep();
  const selectionIdModel = useSelectionIdModel([]);

  // Song Data
  const songQuery = useSongQuery(songId ?? '');
  const { mutate, isPending: isSaving } = useSongMutation();
  const [isDirty, setIsDirty] = useState(false);
  const [song, setSong] = useState<Song | null>(null);

  const onSetSong: React.Dispatch<React.SetStateAction<Song | null>> = (updatedSong) => {
    setSong(updatedSong);
    setIsDirty(true);
  };

  const onUpdateSong = (updatedSong: Partial<Song>) => {
    setSong((prevSong) => {
      if (!prevSong) return null;
      return { ...prevSong, ...updatedSong };
    });
    setIsDirty(true);
  };

  useEffect(() => {
    if (songQuery.isSuccess) {
      setSong(songQuery.data);
    }
  }, [songQuery.data, songQuery.isSuccess]);

  const isReady = useMemo(() => {
    if (!song) return false;
    return distributor.isSongReady(song);
  }, [song]);

  // Song Summary

  if (songQuery.isLoading) {
    return <ContentLoading />;
  }

  if (songQuery.isError) {
    return <ContentError>{songQuery.error.message}</ContentError>;
  }

  if (!songQuery.isSuccess && !song) {
    return <ContentError>Could not find song</ContentError>;
  }

  // Failsafe
  if (!song) {
    return <ContentLoading>Building local song instance</ContentLoading>;
  }

  const saveSong = () => mutate(song, { onSuccess: () => setIsDirty(false) });

  return (
    <SongEditContext.Provider
      value={{
        stepper,
        song,
        isReady,
        isDirty,
        setSong: onSetSong,
        updateSong: onUpdateSong,
        saveSong,
        isSaving,
        selectionIdModel,
      }}
    >
      {children}
    </SongEditContext.Provider>
  );
};

export const useSongEditContext = () => {
  const context = useContext(SongEditContext);

  if (!context) {
    throw new Error('useSongEditContext must be used within a SongEditProvider');
  }

  return context;
};
