/**
 * 变量监视 / 内存面板 / 调用栈 三个状态面板（VISUALIZATION_SPEC §5.9）。
 */
import type { CallFrame, MemorySnapshot, VarSnapshot } from '../../core/types';

/* ============ 变量监视面板 ============ */

const KIND_LABEL: Record<VarSnapshot['kind'], string> = {
  int: 'int',
  pointer: '指针',
  index: '下标',
  bool: 'bool',
  size: 'size',
  other: '值',
};

export function VariablesPanel({ variables }: { variables: VarSnapshot[] }): React.ReactElement {
  return (
    <section className="panel vars-panel" aria-label="变量监视">
      <header className="panel-header">
        <h3>变量</h3>
      </header>
      <div className="panel-body">
        {variables.length === 0 ? (
          <p className="empty-hint">当前步骤没有监视中的变量</p>
        ) : (
          <table className="vars-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>值</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => (
                <tr key={v.name} className={v.kind === 'pointer' ? 'var-ptr' : undefined}>
                  <td className="var-name">{v.name}</td>
                  <td className="var-kind">{KIND_LABEL[v.kind]}</td>
                  <td className={v.value === null ? 'var-null' : 'var-value'}>
                    {v.value === null ? 'NULL' : v.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/* ============ 内存面板（教学模拟地址） ============ */

export function MemoryPanel({ memory }: { memory: MemorySnapshot }): React.ReactElement {
  // 指针箭头：值正好等于某对象地址时标注指向关系
  const objectAddrs = new Map<string, string>();
  for (const cell of memory.cells) {
    if (!cell.id.startsWith('var:')) objectAddrs.set(cell.addr, cell.name);
  }
  return (
    <section className="panel mem-panel" aria-label="内存面板">
      <header className="panel-header">
        <h3>内存</h3>
        <span className="mem-badge" title="地址为教学演示用的模拟地址，并非真实系统内存地址">
          模拟地址
        </span>
      </header>
      <div className="panel-body">
        {memory.cells.length === 0 ? (
          <p className="empty-hint">当前没有内存对象</p>
        ) : (
          <table className="mem-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>地址</th>
                <th>值</th>
              </tr>
            </thead>
            <tbody>
              {memory.cells.map((cell) => {
                const pointsTo = cell.id.startsWith('var:') ? objectAddrs.get(cell.value) : undefined;
                return (
                  <tr key={cell.id} className={cell.freed ? 'mem-freed' : undefined}>
                    <td className="mem-name">
                      {cell.name}
                      {pointsTo !== undefined && <span className="mem-arrow"> → {pointsTo}</span>}
                    </td>
                    <td className="mem-addr">{cell.addr}</td>
                    <td className="mem-value">{cell.value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mem-footnote">※ 地址为教学模拟地址（栈区/堆区示意），非真实系统内存。</p>
      </div>
    </section>
  );
}

/* ============ 调用栈面板 ============ */

export function CallStackPanel({ frames }: { frames: CallFrame[] }): React.ReactElement {
  return (
    <section className="panel stack-panel" aria-label="调用栈">
      <header className="panel-header">
        <h3>调用栈</h3>
        <span className="panel-sub">栈顶在上</span>
      </header>
      <div className="panel-body">
        {frames.length === 0 ? (
          <p className="empty-hint">调用栈为空</p>
        ) : (
          <ol className="callstack-list">
            {frames
              .map((f, i) => ({ f, i }))
              .reverse()
              .map(({ f, i }) => (
                <li key={i} className={i === frames.length - 1 ? 'callframe top' : 'callframe'}>
                  <span className="callframe-fn">{f.fn}</span>
                  {f.detail !== undefined && <span className="callframe-detail">{f.detail}</span>}
                </li>
              ))}
          </ol>
        )}
      </div>
    </section>
  );
}
