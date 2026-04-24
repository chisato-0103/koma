function renderInline(text, keyPrefix) {
  const parts = text.split(/(~~[^~]+~~|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g)
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (!part) return null
    if (part.startsWith('~~') && part.endsWith('~~')) return <del key={key}>{part.slice(2, -2)}</del>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>
    if (part.startsWith('[')) {
      const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
      if (match) {
        return <a key={key} href={match[2]} target="_blank" rel="noreferrer">{match[1]}</a>
      }
    }
    return <span key={key}>{part}</span>
  })
}

function parseListBlock(lines, startIdx, baseIndent, keyPrefix) {
  const items = []
  let i = startIdx
  let hasTaskItem = false

  while (i < lines.length) {
    const line = lines[i]
    const lineIndent = (line.match(/^( *)/)?.[1] ?? '').length
    if (lineIndent < baseIndent) break
    const listMatch = line.match(/^( *)([-*]|\d+\.) +(.*)$/)
    if (!listMatch) break
    if (lineIndent !== baseIndent) { i += 1; continue }

    const content = listMatch[3]
    const taskMatch = content.match(/^\[([ x])\] (.+)$/)
    if (taskMatch) hasTaskItem = true
    i += 1

    let childBlock = null
    if (i < lines.length) {
      const nextIndent = (lines[i].match(/^( *)/)?.[1] ?? '').length
      if (/^ +([-*]|\d+\.) +/.test(lines[i]) && nextIndent > baseIndent) {
        const nextIsOrdered = /^ +\d+\. +/.test(lines[i])
        const result = parseListBlock(lines, i, nextIndent, `${keyPrefix}-n${i}`)
        childBlock = nextIsOrdered
          ? <ol key={`no-${keyPrefix}-${i}`}>{result.items}</ol>
          : <ul key={`nu-${keyPrefix}-${i}`}>{result.items}</ul>
        i = result.nextIdx
      }
    }

    if (taskMatch) {
      const checked = taskMatch[1] === 'x'
      items.push(
        <li key={`li-${keyPrefix}-${i}`} className="task-list-item">
          <input type="checkbox" checked={checked} readOnly />{' '}
          {renderInline(taskMatch[2], `tc-${keyPrefix}-${i}`)}{childBlock}
        </li>
      )
    } else {
      items.push(
        <li key={`li-${keyPrefix}-${i}`}>
          {renderInline(content, `lc-${keyPrefix}-${i}`)}{childBlock}
        </li>
      )
    }
  }

  return { items, nextIdx: i, hasTaskItem }
}

function isTableHeader(lines, idx) {
  if (!lines[idx].includes('|')) return false
  if (idx + 1 >= lines.length) return false
  return /^[| :\-]+$/.test(lines[idx + 1]) && lines[idx + 1].includes('-')
}

export default function MarkdownPreview({ value }) {
  const lines = value.split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i += 1; continue }

    // Code block
    if (line.startsWith('```')) {
      const codeLines = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i += 1 }
      if (i < lines.length) i += 1
      blocks.push(<pre key={`code-${i}`}><code>{codeLines.join('\n')}</code></pre>)
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${i}`} />)
      i += 1
      continue
    }

    // Table
    if (isTableHeader(lines, i)) {
      const headerCells = line.split('|').map(c => c.trim()).filter(Boolean)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean))
        i += 1
      }
      blocks.push(
        <table key={`table-${i}`} className="md-table">
          <thead>
            <tr>{headerCells.map((h, ci) => <th key={ci}>{renderInline(h, `th-${i}-${ci}`)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{renderInline(cell, `td-${i}-${ri}-${ci}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const HeadingTag = `h${level}`
      blocks.push(<HeadingTag key={`h-${i}`}>{renderInline(headingMatch[2], `h-${i}`)}</HeadingTag>)
      i += 1
      continue
    }

    // Unordered list (including task lists and nested)
    if (/^[-*] +/.test(line)) {
      const result = parseListBlock(lines, i, 0, `ul-${i}`)
      blocks.push(
        <ul key={`ul-${i}`} className={result.hasTaskItem ? 'task-list' : undefined}>
          {result.items}
        </ul>
      )
      i = result.nextIdx
      continue
    }

    // Ordered list (including nested)
    if (/^\d+\. +/.test(line)) {
      const result = parseListBlock(lines, i, 0, `ol-${i}`)
      blocks.push(<ol key={`ol-${i}`}>{result.items}</ol>)
      i = result.nextIdx
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines = []
      while (i < lines.length && lines[i].startsWith('> ')) { quoteLines.push(lines[i].slice(2)); i += 1 }
      blocks.push(<blockquote key={`q-${i}`}>{quoteLines.join('\n')}</blockquote>)
      continue
    }

    // Paragraph
    const paragraphLines = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6} +|[-*] +|\d+\. +|> |```)/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !isTableHeader(lines, i)
    ) {
      paragraphLines.push(lines[i])
      i += 1
    }
    if (paragraphLines.length) {
      blocks.push(<p key={`p-${i}`}>{renderInline(paragraphLines.join(' '), `p-${i}`)}</p>)
    } else {
      i += 1
    }
  }

  if (!blocks.length) return <p className="markdown-empty">プレビューはここに表示されます</p>
  return <div className="markdown-preview-content">{blocks}</div>
}
