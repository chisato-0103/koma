import { useState, useEffect } from 'react'
import Setup from './components/Setup'
import Timetable from './components/Timetable'
import NotePage from './components/NotePage'

function App() {
  const [setupComplete, setSetupComplete] = useState(null)
  const [activeSemester, setActiveSemester] = useState(null)
  const [noteCourse, setNoteCourse] = useState(null) // null = timetable, course = note page

  useEffect(() => {
    checkSetup()
  }, [])

  async function checkSetup() {
    const complete = await window.api.isSetupComplete()
    setSetupComplete(complete)
    if (complete) {
      let semester = await window.api.getActiveSemester()
      if (!semester) {
        const semesters = await window.api.getSemesters()
        if (semesters.length > 0) {
          await window.api.setActiveSemester(semesters[0].id)
          semester = semesters[0]
        }
      }
      setActiveSemester(semester)
    }
  }

  if (setupComplete === null) {
    return <div className="loading">読み込み中...</div>
  }

  if (!setupComplete) {
    return <Setup onComplete={checkSetup} />
  }

  if (noteCourse) {
    return (
      <NotePage
        course={noteCourse}
        onBack={() => setNoteCourse(null)}
      />
    )
  }

  return (
    <Timetable
      activeSemester={activeSemester}
      onSemesterChange={setActiveSemester}
      onOpenNote={setNoteCourse}
    />
  )
}

export default App
