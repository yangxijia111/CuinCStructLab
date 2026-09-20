/**
 * P4 阶段占位页面：后续 Phase（P5-P11）逐步替换为完整实现。
 * Home/Structures/Algorithms 提供基础内容；Lab/Coding/Bank/WrongBook/Stats/Settings/Search 为占位。
 */
import { Link } from 'react-router-dom';
import { CHAPTERS } from '../content';
import { SORT_METAS } from '../core/algorithms/sorting-codes';
import { useAppStore } from '../ui/AppStore';

export function HomePage(): React.ReactElement {
  const { progress } = useAppStore();
  const visited = Object.entries(progress).filter(([, p]) => p.status !== 'new');
  const last = visited.sort((a, b) => b[1].lastVisitAt - a[1].lastVisitAt)[0];
  const lastChapter = last === undefined ? undefined : CHAPTERS.find((c) => c.id === Number(last[0]));
  const doneCount = visited.filter(([, p]) => p.status === 'done').length;

  return (
    <div className="page">
      <h1>CuinCStructLab</h1>
      <p className="page-lead">面向 C 语言初学者的数据结构学习、可视化、代码实践与刷题平台。</p>
      <div className="home-cards">
        <div className="home-card main">
          <h3>{lastChapter !== undefined ? '继续学习' : '从这里开始'}</h3>
          <p>
            {lastChapter !== undefined
              ? `第 ${lastChapter.id} 章 · ${lastChapter.title}（${last[1].status === 'done' ? '已完成' : '学习中'}）`
              : '从第 0 章预备知识开始，14 章循序渐进。'}
          </p>
          <Link className="btn primary" to={lastChapter !== undefined ? `/course/${lastChapter.id}` : '/course/0'}>
            {lastChapter !== undefined ? '继续' : '开始学习'} →
          </Link>
        </div>
        <div className="home-card">
          <h3>课程完成度</h3>
          <div className="home-num">{Math.round((doneCount / CHAPTERS.length) * 100)}%</div>
          <p>
            {doneCount} / {CHAPTERS.length} 章已完成
          </p>
        </div>
        <div className="home-card">
          <h3>可视化实验室</h3>
          <p>指针怎么变、递归栈怎么长，看动画就懂。</p>
          <Link className="btn" to="/lab">
            打开实验室 →
          </Link>
        </div>
        <div className="home-card">
          <h3>题库</h3>
          <p>章节练习 + 编程判题，错题自动进错题本。</p>
          <Link className="btn" to="/bank">
            去刷题 →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function StructuresPage(): React.ReactElement {
  const items = [
    { ch: 2, name: '顺序表', desc: '连续内存 + size/capacity，随机访问 O(1)', tag: '数组' },
    { ch: 3, name: '单链表', desc: '节点 + next 指针，插删 O(1)', tag: '链式' },
    { ch: 4, name: '双向链表', desc: 'prev + next，找前驱 O(1)', tag: '链式' },
    { ch: 5, name: '栈', desc: '后进先出 LIFO，push/pop O(1)', tag: '受限线性' },
    { ch: 6, name: '队列', desc: '先进先出 FIFO，循环队列取模回绕', tag: '受限线性' },
    { ch: 7, name: '数组与字符串', desc: '连续内存、\\0 结尾、二维拉平', tag: '基础' },
    { ch: 8, name: '二叉树', desc: '层次结构 + 递归遍历', tag: '树' },
    { ch: 9, name: 'BST', desc: '左小右大，查找 O(log n)', tag: '树' },
    { ch: 10, name: '堆', desc: '完全二叉树存数组，O(1) 取最值', tag: '树' },
    { ch: 11, name: '图', desc: '顶点+边，邻接矩阵/表，DFS/BFS', tag: '图' },
  ];
  return (
    <div className="page">
      <h1>数据结构</h1>
      <p className="page-lead">本平台支持的全部数据结构，点击进入对应章节学习。</p>
      <div className="ds-grid">
        {items.map((it) => (
          <Link key={it.ch} to={`/course/${it.ch}`} className="ds-card">
            <span className="ds-tag">{it.tag}</span>
            <strong>{it.name}</strong>
            <span>{it.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AlgorithmsPage(): React.ReactElement {
  return (
    <div className="page">
      <h1>算法</h1>
      <p className="page-lead">查找与排序：全部支持动画、单步与多算法比较。</p>
      <div className="ds-grid">
        <Link to="/course/12" className="ds-card">
          <span className="ds-tag">查找</span>
          <strong>顺序查找</strong>
          <span>O(n)，不要求有序</span>
        </Link>
        <Link to="/course/12" className="ds-card">
          <span className="ds-tag">查找</span>
          <strong>二分查找</strong>
          <span>O(log n)，前提：有序</span>
        </Link>
        {Object.values(SORT_METAS).map((m) => (
          <Link key={m.id} to="/course/13" className="ds-card">
            <span className="ds-tag">排序</span>
            <strong>{m.name}</strong>
            <span>
              平均 {m.timeAvg} · {m.stable ? '稳定' : '不稳定'} · {m.feature}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function LabPage(): React.ReactElement {
  return (
    <div className="page">
      <h1>可视化实验室</h1>
      <p className="page-lead">（P5-P7 开发中）数组、链表、栈、队列、树、BST、堆、图、排序的互动实验将在此开放。</p>
    </div>
  );
}

export function BankPage(): React.ReactElement {
  return (
    <div className="page">
      <h1>题库</h1>
      <p className="page-lead">（P8 开发中）章节练习与判分将在此开放。</p>
    </div>
  );
}

export function SearchPage(): React.ReactElement {
  return (
    <div className="page">
      <h1>搜索</h1>
      <p className="page-lead">（P10 开发中）知识点 / 数据结构 / 算法 / 题目的全局搜索。</p>
    </div>
  );
}
