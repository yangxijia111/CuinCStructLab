import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './ui/AppLayout';
import { AppStoreProvider } from './ui/AppStore';
import { ChapterPage, CourseListPage } from './pages/CoursePage';
import { AlgorithmsPage, HomePage, StructuresPage } from './pages/Placeholder';
import { SettingsPage } from './pages/SettingsPage';
import { CodingPage } from './pages/CodingPage';
import { LabPage } from './pages/LabPage';
import { BankPage } from './pages/BankPage';
import { WrongBookPage } from './pages/WrongBookPage';
import { StatsPage } from './pages/StatsPage';
import { SearchPage } from './pages/SearchPage';

export function App(): React.ReactElement {
  return (
    <AppStoreProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/course" element={<CourseListPage />} />
          <Route path="/course/:id" element={<ChapterPage />} />
          <Route path="/structures" element={<StructuresPage />} />
          <Route path="/algorithms" element={<AlgorithmsPage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/coding" element={<CodingPage />} />
          <Route path="/bank" element={<BankPage />} />
          <Route path="/wrong-book" element={<WrongBookPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </AppStoreProvider>
  );
}
