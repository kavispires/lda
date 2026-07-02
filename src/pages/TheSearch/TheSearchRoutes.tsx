import { ContentLoading } from '@components/Content';
import { Route, Routes } from 'react-router-dom';
import { useContestantsQuery } from './hooks/useContestants';
import { ContestantBuilderPage } from './pages/ContestantBuilderPage';
import { ContestantsListingPage } from './pages/ContestantsListingPage';
import { LibrariesIndexPage } from './pages/LibrariesIndexPage';
import { LibraryViewerPage } from './pages/LibraryViewerPage';
import { SimulationPage } from './pages/SimulationPage';
import { TheSearchPage } from './pages/TheSearchPage';
import { ContestantsProvider } from './services/ContestantsProvider';

/**
 * Wrapper component for The Search routes that provides the global contestants state
 */
export function TheSearchRoutes() {
  const { data: contestantsData, isLoading } = useContestantsQuery();

  if (isLoading || !contestantsData) {
    return <ContentLoading />;
  }

  return (
    <ContestantsProvider initialData={contestantsData}>
      <Routes>
        <Route element={<TheSearchPage />} path="/" />
        <Route element={<ContestantsListingPage />} path="/contestants" />
        <Route element={<LibrariesIndexPage />} path="/libraries" />
        <Route element={<LibraryViewerPage />} path="/libraries/:type" />
        <Route element={<SimulationPage />} path="/simulation" />
        <Route element={<ContestantBuilderPage />} path="/new" />
        <Route element={<ContestantBuilderPage />} path="/edit" />
      </Routes>
    </ContestantsProvider>
  );
}
