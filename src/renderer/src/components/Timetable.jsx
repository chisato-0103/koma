import { useState, useEffect, Fragment } from 'react'
import CourseModal from './CourseModal'
import SemesterModal from './SemesterModal'
import PeriodSettingsModal from './PeriodSettingsModal'

const DAYS = ['月', '火', '水', '木', '金']

export default function Timetable({ activeSemester, onSemesterChange, onOpenNote }) {
  const [courses, setCourses] = useState([])
  const [periods, setPeriods] = useState([])
  const [semesters, setSemesters] = useState([])
  const [selectedCell, setSelectedCell] = useState(null)
  const [showSemesterModal, setShowSemesterModal] = useState(false)
  const [showPeriodSettings, setShowPeriodSettings] = useState(false)
  const [portalUrl, setPortalUrl] = useState('')
  const [hoveredCell, setHoveredCell] = useState(null)

  useEffect(() => {
    loadData()
  }, [activeSemester])

  async function loadData() {
    const [periodsData, semestersData, settings] = await Promise.all([
      window.api.getPeriodSettings(),
      window.api.getSemesters(),
      window.api.getSettings(),
    ])
    setPeriods(periodsData)
    setSemesters(semestersData)
    setPortalUrl(settings.portal_url || '')

    if (activeSemester) {
      const coursesData = await window.api.getCoursesBySemester(activeSemester.id)
      setCourses(coursesData)
    }
  }

  function getCourse(day, period) {
    return courses.find(c => c.day_of_week === day && c.period === period)
  }

  // 2コマ授業が占有するセルをスキップするセット
  const skippedCells = new Set()
  courses.forEach(c => {
    if ((c.period_count || 1) >= 2) {
      skippedCells.add(`${c.day_of_week}-${c.period + 1}`)
    }
  })

  function handleCellClick(day, period) {
    if (skippedCells.has(`${day}-${period}`)) return
    const course = getCourse(day, period)
    setSelectedCell({ day, period, course: course || null })
  }

  async function handleSaveCourse(courseData) {
    const savedId = await window.api.saveCourse({
      ...courseData,
      semester_id: activeSemester.id,
      day_of_week: selectedCell.day,
      period: selectedCell.period,
    })
    setSelectedCell(null)
    await loadData()
    return savedId
  }

  async function handleDeleteCourse(id) {
    await window.api.deleteCourse(id)
    setSelectedCell(null)
    await loadData()
  }

  async function handleQuickAttendance(e, course, type) {
    e.stopPropagation()
    await window.api.saveCourse({
      ...course,
      present_count: type === 'present' ? course.present_count + 1 : course.present_count,
      absent_count: type === 'absent' ? course.absent_count + 1 : course.absent_count,
    })
    await loadData()
  }

  async function handleSemesterSelect(semester) {
    await window.api.setActiveSemester(semester.id)
    onSemesterChange(semester)
    setShowSemesterModal(false)
  }

  async function handleSemesterUpdate() {
    const [updated, semestersData] = await Promise.all([
      window.api.getActiveSemester(),
      window.api.getSemesters(),
    ])
    setSemesters(semestersData)
    onSemesterChange(updated)
    if (updated) {
      const coursesData = await window.api.getCoursesBySemester(updated.id)
      setCourses(coursesData)
    }
  }

  const lunchStart = periods.find(p => p.period_number === 2)?.end_time
  const lunchEnd   = periods.find(p => p.period_number === 3)?.start_time

  return (
    <div className="app">
      <header className="header">
        <h1>時間割</h1>
        <div className="header-controls">
          <select
            value={activeSemester?.id || ''}
            onChange={async (e) => {
              const sem = semesters.find(s => s.id === Number(e.target.value))
              if (sem) {
                await window.api.setActiveSemester(sem.id)
                onSemesterChange(sem)
              }
            }}
            className="semester-select"
          >
            {semesters.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={() => setShowSemesterModal(true)}>
            学期管理
          </button>
          {portalUrl && (
            <button
              className="btn-portal"
              onClick={() => window.api.openExternal(portalUrl)}
              title="大学ポータルを開く"
            >
              ポータル
            </button>
          )}
          <button
            className="btn-icon"
            onClick={() => setShowPeriodSettings(true)}
            title="コマの時間を設定"
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="timetable-container">
        <table className="timetable">
          <thead>
            <tr>
              <th className="period-header-cell"></th>
              {DAYS.map(day => (
                <th key={day} className="day-header">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <Fragment key={p.period_number}>
                <tr>
                  <td className="period-label">
                    <span className="period-number">{p.period_number}限</span>
                    <span className="period-time">{p.start_time}〜{p.end_time}</span>
                  </td>
                  {DAYS.map((_, dayIndex) => {
                    const cellKey = `${dayIndex}-${p.period_number}`
                    if (skippedCells.has(cellKey)) return null

                    const course = getCourse(dayIndex, p.period_number)
                    const rowSpanVal = (course?.period_count || 1) >= 2 ? 2 : 1
                    const isHovered = hoveredCell?.day === dayIndex && hoveredCell?.period === p.period_number
                    const hasNotes = course?.note?.trim() || course?.session_count > 0

                    return (
                      <td
                        key={dayIndex}
                        rowSpan={rowSpanVal}
                        className={`timetable-cell ${course ? 'has-course' : 'empty-cell'}`}
                        onClick={() => handleCellClick(dayIndex, p.period_number)}
                        onMouseEnter={() => course && setHoveredCell({ day: dayIndex, period: p.period_number })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {course ? (
                          <div className="course-info">
                            <div className="course-name">{course.name}</div>
                            {course.classroom && (
                              <div className="course-classroom">{course.classroom}</div>
                            )}
                            <div className="course-meta">
                              <span>出{course.present_count || 0}</span>
                              <span>欠{course.absent_count || 0}</span>
                              {hasNotes && <span>📝</span>}
                            </div>
                            {isHovered && (
                              <div className="attendance-overlay">
                                <button
                                  className="att-btn att-present"
                                  onClick={e => handleQuickAttendance(e, course, 'present')}
                                >
                                  出席 +1
                                </button>
                                <button
                                  className="att-btn att-absent"
                                  onClick={e => handleQuickAttendance(e, course, 'absent')}
                                >
                                  欠席 +1
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="add-icon">+</span>
                        )}
                      </td>
                    )
                  })}
                </tr>

                {p.period_number === 2 && lunchStart && lunchEnd && (
                  <tr className="lunch-break-row">
                    <td className="lunch-break-label">
                      <span className="lunch-break-text">昼休み</span>
                      <span className="lunch-break-time">{lunchStart}〜{lunchEnd}</span>
                    </td>
                    <td colSpan={5} className="lunch-break-cell" />
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </main>

      {selectedCell && (
        <CourseModal
          cell={selectedCell}
          course={selectedCell.course}
          courses={courses}
          semesterId={activeSemester?.id}
          onSave={handleSaveCourse}
          onDelete={handleDeleteCourse}
          onOpenNote={onOpenNote}
          onClose={() => setSelectedCell(null)}
        />
      )}

      {showSemesterModal && (
        <SemesterModal
          semesters={semesters}
          activeSemester={activeSemester}
          onSelect={handleSemesterSelect}
          onUpdate={handleSemesterUpdate}
          onClose={() => setShowSemesterModal(false)}
        />
      )}

      {showPeriodSettings && (
        <PeriodSettingsModal
          onSaved={loadData}
          onClose={() => {
            setShowPeriodSettings(false)
            window.api.getSettings().then(s => setPortalUrl(s.portal_url || ''))
          }}
        />
      )}
    </div>
  )
}
