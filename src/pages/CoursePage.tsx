/**
 * 课程页：/course 章节列表；/course/:id 章节详情（左目录 / 中正文 / 右代码面板）（UI_UX_SPEC §3.1）。
 * 动画小节的 vizOps 在 P5-P7 接入可视化组件后可点击运行；此处先展示操作卡片。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { C_PROGRAMS, CHAPTERS, SECTION_KIND_TITLES } from '../content';
import type { Section } from '../content';
import { CodePanel } from '../visualization/panels/CodePanel';
import { useAppStore } from '../ui/AppStore';

export function CourseListPage(): React.ReactElement {
  const { progress } = useAppStore();
  return (
    <div className="page">
      <h1>课程</h1>
      <p className="page-lead">从 C 预备知识到排序，14 章循序渐进。每一章都遵循统一的学习结构。</p>
      <ol className="chapter-grid">
        {CHAPTERS.map((ch) => {
          const p = progress[ch.id];
          return (
            <li key={ch.id}>
              <Link to={`/course/${ch.id}`} className="chapter-card">
                <span className="chapter-no">第 {ch.id} 章</span>
                <strong>{ch.title}</strong>
                <span className="chapter-sub">{ch.subtitle}</span>
                <span className={p?.status === 'done' ? 'chapter-status done' : p?.status === 'learning' ? 'chapter-status learning' : 'chapter-status'}>
                  {p?.status === 'done' ? '✓ 已完成' : p?.status === 'learning' ? '学习中' : '未学习'}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ChapterPage(): React.ReactElement {
  const { id } = useParams();
  const chapterId = Number(id ?? '0');
  const chapter = useMemo(() => CHAPTERS.find((c) => c.id === chapterId), [chapterId]);
  const [activeSection, setActiveSection] = useState(0);
  const { visitChapter, markChapterDone, progress, isFavorite, toggleFavorite, notes, saveNote } = useAppStore();
  const [noteDraft, setNoteDraft] = useState('');
  const fav = isFavorite('chapter', String(chapterId));
  const noteKey = `chapter:${chapterId}`;

  useEffect(() => {
    if (chapter !== undefined) {
      visitChapter(chapter.id, activeSection);
    }
  }, [chapter, activeSection, visitChapter]);

  if (chapter === undefined) {
    return (
      <div className="page">
        <h1>章节不存在</h1>
        <Link to="/course">返回课程列表</Link>
      </div>
    );
  }

  const section = chapter.sections[activeSection];
  const program = section?.codeId !== undefined ? C_PROGRAMS[section.codeId] : undefined;

  return (
    <div className="chapter-layout">
      <aside className="chapter-toc" aria-label="课程目录">
        <Link to="/course" className="toc-back">
          ← 课程列表
        </Link>
        <div className="toc-title">
          第 {chapter.id} 章 · {chapter.title}
        </div>
        <ol>
          {chapter.sections.map((s, i) => (
            <li key={s.kind}>
              <button
                type="button"
                className={i === activeSection ? 'toc-item active' : 'toc-item'}
                onClick={() => setActiveSection(i)}
              >
                <span className="toc-no">{i + 1}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <article className="chapter-body">
        <header className="chapter-head">
          <h1>{chapter.title}</h1>
          <p>{chapter.subtitle}</p>
          <button
            type="button"
            className={fav ? 'btn fav on' : 'btn fav'}
            onClick={() => toggleFavorite('chapter', String(chapterId))}
          >
            {fav ? '★ 已收藏' : '☆ 收藏本章'}
          </button>
        </header>
        {section !== undefined && <SectionView section={section} chapterId={chapter.id} />}
        <section className="panel chapter-note">
          <h3>学习笔记</h3>
          <textarea
            value={noteDraft}
            placeholder={notes[noteKey] !== undefined ? '' : '记录你的理解、疑问或总结（自动保存到本地）…'}
            onChange={(e) => setNoteDraft(e.target.value)}
          />
          <div className="note-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                saveNote('chapter', String(chapterId), noteDraft);
              }}
            >
              保存笔记
            </button>
            {notes[noteKey] !== undefined && (
              <button type="button" className="btn" onClick={() => setNoteDraft(notes[noteKey] ?? '')}>
                载入已有笔记
              </button>
            )}
            {noteDraft !== '' && (
              <span className="empty-hint">{noteDraft.length} 字</span>
            )}
          </div>
          {notes[noteKey] !== undefined && notes[noteKey] !== '' && (
            <pre className="note-saved">{notes[noteKey]}</pre>
          )}
        </section>
        <footer className="chapter-foot-nav">
          <button
            type="button"
            className="btn"
            disabled={activeSection === 0}
            onClick={() => setActiveSection((i) => Math.max(0, i - 1))}
          >
            ← 上一节
          </button>
          {activeSection === chapter.sections.length - 1 ? (
            <button type="button" className="btn primary" onClick={() => markChapterDone(chapter.id)}>
              {progress[chapter.id]?.status === 'done' ? '✓ 已完成本章' : '完成本章'}
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setActiveSection((i) => i + 1)}>
              下一节 →
            </button>
          )}
        </footer>
      </article>

      <aside className="chapter-code">
        {program !== undefined ? (
          <CodePanel title={program.title} lines={program.lines.map((l) => ({ text: l, note: program.notes?.[program.lines.indexOf(l) + 1] }))} />
        ) : (
          <div className="panel chapter-code-empty">
            <p>本小节没有关联的 C 代码。</p>
            <p className="empty-hint">切换到「C 语言结构定义」或「逐行 C 代码」小节查看代码。</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function SectionView({ section, chapterId }: { section: Section; chapterId: number }): React.ReactElement {
  const kindTitle = SECTION_KIND_TITLES[section.kind];
  return (
    <section className="section-view">
      <div className="section-kind">{kindTitle}</div>
      <h2>{section.title}</h2>
      {(section.body ?? []).map((para, i) => (
        <BodyBlock key={i} text={para} />
      ))}
      {section.bullets !== undefined && section.bullets.length > 0 && (
        <ul className="section-bullets">
          {section.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {section.table !== undefined && (
        <table className="section-table">
          <thead>
            <tr>
              {section.table.headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(section.vizOps ?? []).length > 0 && (
        <div className="viz-op-list">
          {(section.vizOps ?? []).map((op, i) => (
            <div key={i} className="viz-op-card">
              <span className="viz-op-tag">动画</span>
              {op.label}
              <Link to={`/lab?chapter=${chapterId}`} className="viz-op-run">
                在实验室打开 →
              </Link>
            </div>
          ))}
        </div>
      )}
      {section.kind === 'quiz' && (
        <div className="viz-op-card">
          <span className="viz-op-tag">练习</span>
          <Link to={`/bank?chapter=${chapterId}`}>去题库做本章小测验 →</Link>
        </div>
      )}
      {section.kind === 'exercise' && (
        <div className="viz-op-card">
          <span className="viz-op-tag">编程</span>
          <Link to={`/coding?chapter=${chapterId}`}>去代码练习做本章编程题 →</Link>
        </div>
      )}
    </section>
  );
}

/** 渲染正文段落：``` 包裹的渲染为代码块；**加粗** 转换 */
function BodyBlock({ text }: { text: string }): React.ReactElement {
  const trimmed = text.replace(/^\n+|\n+$/g, '');
  if (trimmed.startsWith('```')) {
    const code = trimmed.replace(/^```[a-z]*\n?/, '').replace(/```$/, '');
    return (
      <pre className="section-code-block">
        <code>{code}</code>
      </pre>
    );
  }
  const parts = trimmed.split(/\*\*([^*]+)\*\*/g);
  return (
    <p className="section-para">
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))}
    </p>
  );
}
