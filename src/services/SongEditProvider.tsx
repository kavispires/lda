import { ContentError, ContentLoading } from 'components/Content';
import { useSelectionIdModel } from 'hooks/useSelectionIdModel';
import { useSongMutation, useSongQuery } from 'hooks/useSongQuery';
import { UseStep, useStep } from 'hooks/useStep';
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Song } from 'types';

type SongEditContextType = {
  stepper: UseStep;
  selectionIdModel: ReturnType<typeof useSelectionIdModel>;
  song: Song;
  setSong: React.Dispatch<React.SetStateAction<Song | null>>;
  saveSong: () => void;
  isSaving: boolean;
};

const SongEditContext = createContext<SongEditContextType | undefined>(undefined);

export const SongEditProvider = ({ children }: PropsWithChildren) => {
  const { songId } = useParams();
  const stepper = useStep();
  const selectionIdModel = useSelectionIdModel([]);

  // Song Data
  const songQuery = useSongQuery(songId ?? '');
  const { mutate, isPending: isSaving } = useSongMutation();

  const [song, setSong] = useState<Song | null>(null);

  useEffect(() => {
    if (songQuery.isSuccess) {
      setSong(songQuery.data);
    }
  }, [songQuery.data, songQuery.isSuccess]);

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

  const saveSong = () => mutate(song);

  return (
    <SongEditContext.Provider value={{ stepper, song, setSong, saveSong, isSaving, selectionIdModel }}>
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
