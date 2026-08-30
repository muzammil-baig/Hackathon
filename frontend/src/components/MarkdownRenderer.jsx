// Simple inline Markdown renderer — handles all patterns from Claude responses
// Supports: ## headings, **bold**, `inline code`, code blocks, lists, tables, ---

function parseInline(text) {
  // Process: **bold**, `code`, *italic*
  const parts = [];
  let rest = text;
  let k = 0;

  while (rest.length > 0) {
    // **bold**
    const boldIdx = rest.indexOf('**');
    const codeIdx = rest.indexOf('`');
    const italicIdx = rest.search(/(?<!\*)\*(?!\*)/);

    const earliest = Math.min(
      boldIdx >= 0 ? boldIdx : Infinity,
      codeIdx >= 0 ? codeIdx : Infinity,
      italicIdx >= 0 ? italicIdx : Infinity
    );

    if (earliest === Infinity) { parts.push(<span key={k++}>{rest}</span>); break; }

    if (earliest > 0) { parts.push(<span key={k++}>{rest.slice(0, earliest)}</span>); rest = rest.slice(earliest); continue; }

    if (rest.startsWith('**')) {
      const end = rest.indexOf('**', 2);
      if (end === -1) { parts.push(<span key={k++}>{rest}</span>); break; }
      parts.push(<strong key={k++} className="font-bold text-[#F4F4F5]">{rest.slice(2, end)}</strong>);
      rest = rest.slice(end + 2); continue;
    }

    if (rest.startsWith('`')) {
      const end = rest.indexOf('`', 1);
      if (end === -1) { parts.push(<span key={k++}>{rest}</span>); break; }
      parts.push(
        <code key={k++} className="font-mono-ibm text-[#10B981] bg-[#050505] px-1.5 py-0.5 text-xs border border-[#27272A] rounded-sm">
          {rest.slice(1, end)}
        </code>
      );
      rest = rest.slice(end + 1); continue;
    }

    // italic *text*
    const italicEnd = rest.indexOf('*', 1);
    if (italicEnd === -1) { parts.push(<span key={k++}>{rest}</span>); break; }
    parts.push(<em key={k++} className="italic text-[#A1A1AA]">{rest.slice(1, italicEnd)}</em>);
    rest = rest.slice(italicEnd + 1);
  }
  return parts;
}

export default function MarkdownRenderer({ content, className = "", compact = false }) {
  if (!content) return null;

  const elements = [];
  const lines = content.split('\n');
  let i = 0;
  let listBuffer = [];
  let listType = null;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item, li) => (
      <li key={li} className="flex items-start gap-2 mb-0.5">
        <span className="text-[#4F46E5] flex-shrink-0 mt-0.5 font-mono-ibm text-xs">
          {listType === 'ol' ? `${li + 1}.` : '▸'}
        </span>
        <span className={compact ? "text-xs text-[#A1A1AA]" : "text-sm text-[#A1A1AA] leading-relaxed"}>
          {parseInline(item)}
        </span>
      </li>
    ));
    elements.push(
      <ul key={`list-${i}`} className="space-y-0 my-2 ml-1">{items}</ul>
    );
    listBuffer = [];
    listType = null;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      flushList();
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-[#050505] border border-[#27272A] p-4 my-3 overflow-x-auto rounded-sm">
          {lang && (
            <div className="text-[9px] font-mono-ibm text-[#3F3F46] mb-2 tracking-[0.15em] uppercase">{lang}</div>
          )}
          <code className="text-xs font-mono-ibm text-[#10B981] leading-relaxed whitespace-pre">
            {codeLines.join('\n')}
          </code>
        </pre>
      );
      i++;
      continue;
    }

    // Table row
    if (line.startsWith('|')) {
      flushList();
      const cells = line.split('|').filter((_, ci, a) => ci > 0 && ci < a.length - 1).map(c => c.trim());
      const isSep = cells.every(c => /^[-:]+$/.test(c));
      if (!isSep) {
        elements.push(
          <tr key={i} className="border-b border-[#18181B]">
            {cells.map((cell, ci) => (
              <td key={ci} className="px-3 py-1.5 text-xs font-mono-ibm text-[#A1A1AA] text-left">
                {parseInline(cell)}
              </td>
            ))}
          </tr>
        );
        // Check if table started
        if (elements.length > 0 && elements[elements.length - 1].type !== 'table') {
          const rows = [elements.pop()];
          // Collect all table rows
          i++;
          while (i < lines.length && lines[i].startsWith('|')) {
            const r = lines[i];
            const rc = r.split('|').filter((_, ci, a) => ci > 0 && ci < a.length - 1).map(c => c.trim());
            const isSepRow = rc.every(c => /^[-:]+$/.test(c));
            if (!isSepRow) {
              rows.push(
                <tr key={i} className="border-b border-[#18181B]">
                  {rc.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-xs font-mono-ibm text-[#A1A1AA]">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              );
            }
            i++;
          }
          elements.push(
            <div key={`table-${i}`} className="my-3 border border-[#27272A] overflow-x-auto">
              <table className="w-full border-collapse">{rows}</table>
            </div>
          );
          continue;
        }
      }
      i++;
      continue;
    }

    // Headings
    if (line.startsWith('#### ')) {
      flushList();
      elements.push(<h4 key={i} className="text-sm font-bold font-mono-ibm text-[#F4F4F5] mt-3 mb-0.5">{parseInline(line.slice(5))}</h4>);
      i++; continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={i} className={`font-bold font-mono-ibm text-[#F4F4F5] mt-4 mb-1 ${compact ? 'text-sm' : 'text-base'}`}>{parseInline(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={i} className={`font-bold font-mono-ibm text-[#F4F4F5] mt-5 mb-2 pb-1.5 border-b border-[#27272A] ${compact ? 'text-base' : 'text-lg'}`}>
          {parseInline(line.slice(3))}
        </h2>
      );
      i++; continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(<h1 key={i} className="text-xl font-bold font-mono-ibm text-[#F4F4F5] mt-5 mb-2">{parseInline(line.slice(2))}</h1>);
      i++; continue;
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      flushList();
      elements.push(<hr key={i} className="border-[#27272A] my-4" />);
      i++; continue;
    }

    // Lists
    if (line.match(/^[-*]\s/)) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listBuffer.push(line.slice(2));
      i++; continue;
    }
    if (line.match(/^\d+\.\s/)) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listBuffer.push(line.replace(/^\d+\.\s/, ''));
      i++; continue;
    }

    // Empty line
    if (!line.trim()) {
      flushList();
      if (!compact) elements.push(<div key={i} className="h-2" />);
      i++; continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={i} className={`leading-relaxed ${compact ? 'text-xs text-[#A1A1AA]' : 'text-sm text-[#E4E4E7]'} mb-0`}>
        {parseInline(line)}
      </p>
    );
    i++;
  }

  flushList();
  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
}
