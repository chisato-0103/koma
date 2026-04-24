import { useState } from 'react'

const DAY_NAMES = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日']

export default function CourseModal({ cell, course, courses, semesterId, onSave, onDelete, onOpenNote, onClose }) {
  const [name, setName] = useState(course?.name || '')
  const [classroom, setClassroom] = useState(course?.classroom || '')
  const [moodleUrl, setMoodleUrl] = useState(course?.moodle_url || '')
  const [syllabusUrl, setSyllabusUrl] = useState(course?.syllabus_url || '')
  const [teamsUrl, setTeamsUrl] = useState(course?.teams_url || '')
  const [presentCount, setPresentCount] = useState(course?.present_count || 0)
  const [absentCount, setAbsentCount] = useState(course?.absent_count || 0)
  const [periodCount, setPeriodCount] = useState(course?.period_count || 1)
  const [saving, setSaving] = useState(false)

  const [showMoodle, setShowMoodle] = useState(!!(course?.moodle_url))
  const [showSyllabus, setShowSyllabus] = useState(!!(course?.syllabus_url))
  const [showTeams, setShowTeams] = useState(!!(course?.teams_url))

  // 2コマ可能かどうか判定（2限はランチまたぎで不可、6限は次がない）
  const nextPeriodTaken = (courses || []).some(
    c => c.id !== course?.id && c.day_of_week === cell.day && c.period === cell.period + 1
  )
  const canBeDouble = cell.period < 6 && cell.period !== 2 && !nextPeriodTaken

  const title = course
    ? `${DAY_NAMES[cell.day]} ${cell.period}限を編集`
    : `${DAY_NAMES[cell.day]} ${cell.period}限に授業を追加`

  function buildCourseData(savedId) {
    return {
      ...(course || {}),
      id: course?.id || savedId,
      semester_id: course?.semester_id ?? semesterId,
      day_of_week: course?.day_of_week !== undefined ? course.day_of_week : cell.day,
      period: course?.period ?? cell.period,
      name: name.trim(),
      classroom: classroom.trim(),
      moodle_url: moodleUrl.trim(),
      syllabus_url: syllabusUrl.trim(),
      teams_url: teamsUrl.trim(),
      note: course?.note || '',
      present_count: Math.max(0, Number(presentCount) || 0),
      absent_count: Math.max(0, Number(absentCount) || 0),
      period_count: canBeDouble ? periodCount : 1,
    }
  }

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    await onSave(buildCourseData())
  }

  async function handleOpen(url) {
    if (url.trim()) await window.api.openExternal(url.trim())
  }

  async function handleOpenNote() {
    if (!name.trim() || saving) return
    setSaving(true)
    const savedId = await onSave(buildCourseData())
    onOpenNote(buildCourseData(savedId))
  }

  const hasNotes = course?.note?.trim() || (course?.session_count > 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>授業名 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：線形代数"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          <div className="form-group">
            <label>教室</label>
            <input
              type="text"
              value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
              placeholder="例：A棟101"
            />
          </div>

          {canBeDouble && (
            <div className="form-group">
              <label>コマ数</label>
              <div className="period-count-toggle">
                <button
                  type="button"
                  className={`period-count-btn ${periodCount === 1 ? 'active' : ''}`}
                  onClick={() => setPeriodCount(1)}
                >
                  1コマ
                </button>
                <button
                  type="button"
                  className={`period-count-btn ${periodCount === 2 ? 'active' : ''}`}
                  onClick={() => setPeriodCount(2)}
                >
                  2コマ
                </button>
              </div>
            </div>
          )}

          {course && (
            <div className="form-group">
              <button
                className="btn-note-open"
                type="button"
                onClick={handleOpenNote}
                disabled={!name.trim() || saving}
              >
                <span className="btn-note-icon">📝</span>
                ノートを開く
                {hasNotes && <span className="note-exists-badge">記録あり</span>}
              </button>
            </div>
          )}

          {showMoodle ? (
            <div className="form-group">
              <label>Moodle URL</label>
              <div className="url-input-group">
                <input
                  type="url"
                  value={moodleUrl}
                  onChange={(e) => setMoodleUrl(e.target.value)}
                  placeholder="https://..."
                  autoFocus={!course?.moodle_url}
                />
                {moodleUrl.trim() && (
                  <button className="btn-link" type="button" onClick={() => handleOpen(moodleUrl)}>開く</button>
                )}
              </div>
            </div>
          ) : null}

          {showTeams ? (
            <div className="form-group">
              <label>Teams URL</label>
              <div className="url-input-group">
                <input
                  type="url"
                  value={teamsUrl}
                  onChange={(e) => setTeamsUrl(e.target.value)}
                  placeholder="https://teams.microsoft.com/..."
                  autoFocus={!course?.teams_url}
                />
                {teamsUrl.trim() && (
                  <button className="btn-link" type="button" onClick={() => handleOpen(teamsUrl)}>開く</button>
                )}
              </div>
            </div>
          ) : null}

          {showSyllabus ? (
            <div className="form-group">
              <label>シラバス URL</label>
              <div className="url-input-group">
                <input
                  type="url"
                  value={syllabusUrl}
                  onChange={(e) => setSyllabusUrl(e.target.value)}
                  placeholder="https://..."
                  autoFocus={!course?.syllabus_url}
                />
                {syllabusUrl.trim() && (
                  <button className="btn-link" type="button" onClick={() => handleOpen(syllabusUrl)}>開く</button>
                )}
              </div>
            </div>
          ) : null}

          {(!showMoodle || !showTeams || !showSyllabus) && (
            <div className="url-add-row">
              {!showMoodle && (
                <button className="btn-url-add" type="button" onClick={() => setShowMoodle(true)}>+ Moodle</button>
              )}
              {!showTeams && (
                <button className="btn-url-add" type="button" onClick={() => setShowTeams(true)}>+ Teams</button>
              )}
              {!showSyllabus && (
                <button className="btn-url-add" type="button" onClick={() => setShowSyllabus(true)}>+ シラバス</button>
              )}
            </div>
          )}

          <div className="form-group">
            <label>出欠カウント</label>
            <div className="attendance-grid">
              <div className="attendance-item">
                <span className="attendance-label">出席</span>
                <div className="attendance-controls">
                  <button type="button" className="btn-attendance" onClick={() => setPresentCount(prev => Math.max(0, prev - 1))}>-</button>
                  <input
                    type="number"
                    min="0"
                    value={presentCount}
                    onChange={(e) => setPresentCount(Math.max(0, Number(e.target.value) || 0))}
                  />
                  <button type="button" className="btn-attendance" onClick={() => setPresentCount(prev => prev + 1)}>+</button>
                </div>
              </div>
              <div className="attendance-item">
                <span className="attendance-label">欠席</span>
                <div className="attendance-controls">
                  <button type="button" className="btn-attendance" onClick={() => setAbsentCount(prev => Math.max(0, prev - 1))}>-</button>
                  <input
                    type="number"
                    min="0"
                    value={absentCount}
                    onChange={(e) => setAbsentCount(Math.max(0, Number(e.target.value) || 0))}
                  />
                  <button type="button" className="btn-attendance" onClick={() => setAbsentCount(prev => prev + 1)}>+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {course && (
            <button className="btn-danger" onClick={() => onDelete(course.id)}>削除</button>
          )}
          <div className="modal-footer-right">
            <button className="btn-secondary" onClick={onClose}>キャンセル</button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
