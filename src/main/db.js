const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')

let db

function getDb() {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'timetable.db')
    db = new Database(dbPath)
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS period_settings (
      period_number INTEGER PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      semester_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      period INTEGER NOT NULL,
      classroom TEXT DEFAULT '',
      moodle_url TEXT DEFAULT '',
      syllabus_url TEXT DEFAULT '',
      FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
    );
  `)
}

function getSemesters() {
  return getDb().prepare('SELECT * FROM semesters ORDER BY id').all()
}

function getActiveSemester() {
  return getDb().prepare('SELECT * FROM semesters WHERE is_active = 1').get() || null
}

function createSemester(name) {
  const result = getDb().prepare('INSERT INTO semesters (name, is_active) VALUES (?, 0)').run(name)
  return result.lastInsertRowid
}

function setActiveSemester(id) {
  const d = getDb()
  d.prepare('UPDATE semesters SET is_active = 0').run()
  d.prepare('UPDATE semesters SET is_active = 1 WHERE id = ?').run(id)
}

function deleteSemester(id) {
  getDb().prepare('DELETE FROM semesters WHERE id = ?').run(id)
}

function getPeriodSettings() {
  return getDb().prepare('SELECT * FROM period_settings ORDER BY period_number').all()
}

function savePeriodSettings(periods) {
  const d = getDb()
  const stmt = d.prepare(
    'INSERT OR REPLACE INTO period_settings (period_number, start_time, end_time) VALUES (?, ?, ?)'
  )
  const run = d.transaction((list) => {
    for (const p of list) stmt.run(p.period_number, p.start_time, p.end_time)
  })
  run(periods)
}

function isSetupComplete() {
  return getPeriodSettings().length === 6
}

function getCoursesBySemester(semesterId) {
  return getDb().prepare('SELECT * FROM courses WHERE semester_id = ?').all(semesterId)
}

function saveCourse(course) {
  const d = getDb()
  if (course.id) {
    d.prepare(`
      UPDATE courses SET name = ?, classroom = ?, moodle_url = ?, syllabus_url = ?
      WHERE id = ?
    `).run(course.name, course.classroom, course.moodle_url, course.syllabus_url, course.id)
    return course.id
  } else {
    const result = d.prepare(`
      INSERT INTO courses (semester_id, name, day_of_week, period, classroom, moodle_url, syllabus_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      course.semester_id,
      course.name,
      course.day_of_week,
      course.period,
      course.classroom || '',
      course.moodle_url || '',
      course.syllabus_url || ''
    )
    return result.lastInsertRowid
  }
}

function deleteCourse(id) {
  getDb().prepare('DELETE FROM courses WHERE id = ?').run(id)
}

module.exports = {
  getSemesters,
  getActiveSemester,
  createSemester,
  setActiveSemester,
  deleteSemester,
  getPeriodSettings,
  savePeriodSettings,
  isSetupComplete,
  getCoursesBySemester,
  saveCourse,
  deleteCourse,
}
