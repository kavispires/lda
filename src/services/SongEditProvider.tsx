import { ContentError, ContentLoading } from 'components/Content';
import { useSongQuery } from 'hooks/useSongQuery';
import { UseStep, useStep } from 'hooks/useStep';
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Song, SongLine, SongPart, SongSection } from 'types';
import { distributor } from 'utils';

type SongEditContextType = {
  stepper: UseStep;
  song: Song;
  setSong: React.Dispatch<React.SetStateAction<Song | null>>;
};

const SongEditContext = createContext<SongEditContextType | undefined>(undefined);

export const SongEditProvider = ({ children }: PropsWithChildren) => {
  const { songId } = useParams();
  const stepper = useStep();

  // Song Data
  const songQuery = useSongQuery(songId ?? '');

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

  return <SongEditContext.Provider value={{ stepper, song, setSong }}>{children}</SongEditContext.Provider>;
};

export const useSongEditContext = () => {
  const context = useContext(SongEditContext);

  if (!context) {
    throw new Error('useSongEditContext must be used within a SongEditProvider');
  }

  return context;
};
