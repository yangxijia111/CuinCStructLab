import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './ui/AppLayout';
import { AppStoreProvider } from './ui/AppStore';
import { ChapterPage, CourseListPage } from './pages/CoursePage';
import {
  AlgorithmsPage,
  BankPage,
  CodingPage,
  HomePage,
  SearchPage,
  SettingsPage,
  StatsPage,
  StructuresPage,
  WrongBookPage,
} from './pages/Placeholder';
import { LabPage } from './pages/LabPage';

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
