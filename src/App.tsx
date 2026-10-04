import { Route, Routes, useParams, useSearchParams } from 'react-router-dom';
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

/** 以章节 id 作 key：跨章导航时完全重挂载，章内组件级状态（小节/笔记草稿）不残留 */
function ChapterPageKeyed(): React.ReactElement {
  const { id } = useParams();
  return <ChapterPage key={id ?? '0'} />;
}

/** 以 ?chapter= 作 key：同路由不同章节参数（如 /bank?chapter=5 → /bank?chapter=3）也重新初始化筛选 */
function withChapterKey(Page: React.ComponentType): () => React.ReactElement {
  return function Keyed(): React.ReactElement {
    const [params] = useSearchParams();
    return <Page key={params.get('chapter') ?? '_'} />;
  };
}

const LabPageKeyed = withChapterKey(LabPage);
const CodingPageKeyed = withChapterKey(CodingPage);
const BankPageKeyed = withChapterKey(BankPage);

export function App(): React.ReactElement {
  return (
    <AppStoreProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/course" element={<CourseListPage />} />
          <Route path="/course/:id" element={<ChapterPageKeyed />} />
          <Route path="/structures" element={<StructuresPage />} />
          <Route path="/algorithms" element={<AlgorithmsPage />} />
          <Route path="/lab" element={<LabPageKeyed />} />
          <Route path="/coding" element={<CodingPageKeyed />} />
          <Route path="/bank" element={<BankPageKeyed />} />
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
