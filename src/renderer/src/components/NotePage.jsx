import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import MarkdownPreview from './MarkdownPreview'

export default function NotePage({ course, onBack }) {
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState('edit') // 'edit' | 'split' | 'preview'
  const [saveStatus, setSaveStatus] = useState('saved')
  const debounceRef = useRef(null)
  const textareaRef = useRef(null)
  const pendingSelection = useRef(null)
  const currentNoteRef = useRef('')
  const activeSessionRef = useRef(null)

  useLayoutEffect(() => {
    if (pendingSelection.current && textareaRef.current) {
      textareaRef.current.selectionStart = pendingSelection.current.start
      textareaRef.current.selectionEnd = pendingSelection.current.end
      pendingSelection.current = null
    }
  })

  useEffect(() => {
    let active = true
    loadSessions(active)
    return () => { active = false }
  }, [course.id])

  async function loadSessions(active = true) {
    clearTimeout(debounceRef.current)
    if (activeSessionRef.current) {
      await window.api.saveNoteSession(activeSessionRef.current.id, currentNoteRef.current)
    }
    if (!active) return
    activeSessionRef.current = null
    setActiveSession(null)
    setNote('')
    currentNoteRef.current = ''
    setSaveStatus('saved')

    let list = await window.api.getNoteSessions(course.id)
    if (!active) return

    if (list.length === 0) {
      await window.api.createNoteSession(course.id, course)
      if (!active) return
      list = await window.api.getNoteSessions(course.id)
      if (!active) return
    }

    setSessions(list)
    await selectSession(list[0], true)
  }

  async function selectSession(session, skipFlush = false) {
    if (!skipFlush && activeSessionRef.current) {
      clearTimeout(debounceRef.current)
      await window.api.saveNoteSession(activeSessionRef.current.id, currentNoteRef.current)
    }
    activeSessionRef.current = session
    setActiveSession(session)
    setSaveStatus('saved')
    const data = await window.api.readNoteSession(session.id)
    const noteText = data?.note || ''
    currentNoteRef.current = noteText
    setNote(noteText)
  }

  function handleChange(value) {
    setNote(value)
    currentNoteRef.current = value
    setSaveStatus('unsaved')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(value), 1500)
  }

  async function save(value) {
    if (!activeSessionRef.current) return
    setSaveStatus('saving')
    await window.api.saveNoteSession(activeSessionRef.current.id, value)
    setSaveStatus('saved')
  }

  async function handleBack() {
    clearTimeout(debounceRef.current)
    if (saveStatus !== 'saved') {
      await save(currentNoteRef.current)
    }
    onBack()
  }

  function handleKeyDown(e) {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const ta = e.target
    const { selectionStart, selectionEnd, value } = ta
    if (!e.shiftKey) {
      const next = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd)
      pendingSelection.current = { start: selectionStart + 2, end: selectionStart + 2 }
      handleChange(next)
    } else {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
      const lineEndRaw = value.indexOf('\n', selectionEnd === selectionStart ? selectionStart : selectionEnd - 1)
      const actualEnd = lineEndRaw === -1 ? value.length : lineEndRaw
      const selected = value.slice(lineStart, actualEnd)
      const lines = selected.split('\n')
      const dedented = lines.map(l => l.replace(/^ {1,2}/, ''))
      const result = value.slice(0, lineStart) + dedented.join('\n') + value.slice(actualEnd)
      const removed = selected.length - dedented.join('\n').length
      const firstLineRemoved = (lines[0].match(/^ {1,2}/) || [''])[0].length
      pendingSelection.current = {
        start: Math.max(lineStart, selectionStart - firstLineRemoved),
        end: selectionEnd - removed,
      }
      handleChange(result)
    }
  }

  async function handleAddSession() {
    clearTimeout(debounceRef.current)
    if (activeSessionRef.current) {
      await window.api.saveNoteSession(activeSessionRef.current.id, currentNoteRef.current)
    }
    const newSession = await window.api.createNoteSession(course.id, course)
    setSessions(prev => [...prev, newSession])
    await selectSession(newSession, true)
  }

  async function handleDeleteSession(session) {
    if (sessions.length <= 1) return
    if (!window.confirm(`第${session.session_number}回のノートを削除しますか？`)) return
    await window.api.deleteNoteSession(session.id)
    const remaining = sessions.filter(s => s.id !== session.id)
    setSessions(remaining)
    if (activeSession?.id === session.id) {
      await selectSession(remaining[remaining.length - 1], true)
    }
  }

  const statusLabel = { saved: '保存済み', saving: '保存中...', unsaved: '未保存' }[saveStatus]

  const sharedTextareaProps = {
    value: note,
    onChange: e => handleChange(e.target.value),
    onKeyDown: handleKeyDown,
  }

  return (
    <div className="note-page">
      <div className="note-header">
        <button className="note-back-btn" onClick={handleBack}>← 時間割</button>
        <span className={`note-save-status ${saveStatus}`}>{statusLabel}</span>
        <div className="note-mode-toggle">
          <button className={`note-mode-btn ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>編集</button>
          <button className={`note-mode-btn ${mode === 'split' ? 'active' : ''}`} onClick={() => setMode('split')}>分割</button>
          <button className={`note-mode-btn ${mode === 'preview' ? 'active' : ''}`} onClick={() => setMode('preview')}>プレビュー</button>
        </div>
      </div>

      <div className="session-bar">
        {sessions.map(s => (
          <button
            key={s.id}
            className={`session-tab ${activeSession?.id === s.id ? 'active' : ''}`}
            onClick={() => selectSession(s)}
          >
            第{s.session_number}回
            {sessions.length > 1 && (
              <span
                className="session-delete-btn"
                onClick={e => { e.stopPropagation(); handleDeleteSession(s) }}
              >×</span>
            )}
          </button>
        ))}
        <button className="session-add-btn" onClick={handleAddSession}>＋</button>
      </div>

      <div className={`note-body${mode === 'split' ? ' split-mode' : ''}`}>
        {mode !== 'split' && (
          <>
            <h1 className="note-title">{course.name}</h1>
            {course.classroom && <p className="note-subtitle">{course.classroom}</p>}
          </>
        )}

        {mode === 'split' ? (
          <div className="note-split-view">
            <textarea
              ref={textareaRef}
              className="note-editor note-editor-split"
              {...sharedTextareaProps}
            />
            <div className="note-preview-split">
              {note.trim()
                ? <MarkdownPreview value={note} />
                : <p className="note-empty">まだノートがありません。</p>}
            </div>
          </div>
        ) : mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            className="note-editor"
            {...sharedTextareaProps}
            placeholder={"ここにノートを書く...\n\n# 見出し\n- 箇条書き\n**太字** `コード`"}
            autoFocus
          />
        ) : (
          <div className="note-preview-area">
            {note.trim()
              ? <MarkdownPreview value={note} />
              : <p className="note-empty">まだノートがありません。「編集」タブから書き始めましょう。</p>}
          </div>
        )}
      </div>
    </div>
  )
}
