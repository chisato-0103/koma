const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

// ===== DB =====
let db
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri']

function ensureColumn(table, column, ddl) {
  const columns = getDb().prepare(`PRAGMA table_info(${table})`).all()
  const exists = columns.some((col) => col.name === column)
  if (!exists) {
    getDb().prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run()
  }
}

// ===== Settings =====
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'))
  } catch (_) {
    return {}
  }
}

function writeSettings(settings) {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8')
}

function getNotesBaseDir() {
  const settings = readSettings()
  const dir = settings.notes_dir || path.join(app.getPath('userData'), 'notes')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'course'
}

function createNoteRelativePath(course, courseId) {
  const semesterDir = `semester_${course.semester_id}`
  const dayKey = DAY_KEYS[course.day_of_week] || `day${course.day_of_week}`
  const fileName = `p${course.period}_c${courseId}_${normalizeSlug(course.name)}.md`
  return path.join(semesterDir, dayKey, fileName)
}

function createSessionNotePath(course, courseId, sessionNumber) {
  const semesterDir = `semester_${course.semester_id}`
  const dayKey = DAY_KEYS[course.day_of_week] || `day${course.day_of_week}`
  const courseDir = `p${course.period}_c${courseId}_${normalizeSlug(course.name)}`
  return path.join(semesterDir, dayKey, courseDir, `session_${sessionNumber}.md`)
}

function readNoteFromFile(notePath) {
  if (!notePath) return ''
  const absolutePath = path.join(getNotesBaseDir(), notePath)
  try {
    return fs.readFileSync(absolutePath, 'utf8')
  } catch (_) {
    return ''
  }
}

function writeNoteToFile(notePath, noteText) {
  const absolutePath = path.join(getNotesBaseDir(), notePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, noteText, 'utf8')
}

function deleteNoteFile(notePath) {
  if (!notePath) return
  const absolutePath = path.join(getNotesBaseDir(), notePath)
  try {
    fs.unlinkSync(absolutePath)
  } catch (_) {
    // no-op
  }
}

function getDb() {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'timetable.db')
    db = new Database(dbPath)
    db.pragma('foreign_keys = ON')
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
    ensureColumn('courses', 'note', "note TEXT DEFAULT ''")
    ensureColumn('courses', 'note_path', "note_path TEXT DEFAULT ''")
    ensureColumn('courses', 'present_count', 'present_count INTEGER DEFAULT 0')
    ensureColumn('courses', 'absent_count', 'absent_count INTEGER DEFAULT 0')
    ensureColumn('courses', 'teams_url', "teams_url TEXT DEFAULT ''")
    ensureColumn('courses', 'period_count', 'period_count INTEGER DEFAULT 1')
    db.exec(`
      CREATE TABLE IF NOT EXISTS note_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        session_number INTEGER NOT NULL,
        note_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      );
    `)
  }
  return db
}

const dbApi = {
  isSetupComplete() {
    return getDb().prepare('SELECT * FROM period_settings').all().length === 6
  },
  getSemesters() {
    return getDb().prepare('SELECT * FROM semesters ORDER BY id').all()
  },
  getActiveSemester() {
    return getDb().prepare('SELECT * FROM semesters WHERE is_active = 1').get() || null
  },
  createSemester(name) {
    return getDb().prepare('INSERT INTO semesters (name, is_active) VALUES (?, 0)').run(name).lastInsertRowid
  },
  setActiveSemester(id) {
    const d = getDb()
    d.prepare('UPDATE semesters SET is_active = 0').run()
    d.prepare('UPDATE semesters SET is_active = 1 WHERE id = ?').run(id)
  },
  deleteSemester(id) {
    getDb().prepare('DELETE FROM semesters WHERE id = ?').run(id)
  },
  getPeriodSettings() {
    return getDb().prepare('SELECT * FROM period_settings ORDER BY period_number').all()
  },
  savePeriodSettings(periods) {
    const d = getDb()
    const stmt = d.prepare('INSERT OR REPLACE INTO period_settings (period_number, start_time, end_time) VALUES (?, ?, ?)')
    d.transaction((list) => { for (const p of list) stmt.run(p.period_number, p.start_time, p.end_time) })(periods)
  },
  getCoursesBySemester(semesterId) {
    const rows = getDb().prepare('SELECT * FROM courses WHERE semester_id = ?').all(semesterId)
    return rows.map((row) => {
      const sessionCount = getDb()
        .prepare('SELECT COUNT(*) as c FROM note_sessions WHERE course_id = ?')
        .get(row.id)?.c || 0
      return {
        ...row,
        note: row.note_path ? readNoteFromFile(row.note_path) : (row.note || ''),
        session_count: sessionCount,
      }
    })
  },
  saveCourse(course) {
    const d = getDb()
    const note = course.note || ''
    const presentCount = Number.isInteger(course.present_count) ? course.present_count : 0
    const absentCount = Number.isInteger(course.absent_count) ? course.absent_count : 0
    if (course.id) {
      const existing = d.prepare('SELECT note_path FROM courses WHERE id = ?').get(course.id)
      const notePath = existing?.note_path || createNoteRelativePath(course, course.id)
      writeNoteToFile(notePath, note)
      d.prepare('UPDATE courses SET name=?, classroom=?, moodle_url=?, syllabus_url=?, teams_url=?, note=?, note_path=?, present_count=?, absent_count=?, period_count=? WHERE id=?')
       .run(
         course.name,
         course.classroom,
         course.moodle_url,
         course.syllabus_url,
         course.teams_url || '',
         '',
         notePath,
         Math.max(0, presentCount),
         Math.max(0, absentCount),
         course.period_count || 1,
         course.id
       )
      return course.id
    }
    const insertedId = d.prepare(
      'INSERT INTO courses (semester_id, name, day_of_week, period, classroom, moodle_url, syllabus_url, teams_url, note, note_path, present_count, absent_count, period_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    )
             .run(
               course.semester_id,
               course.name,
               course.day_of_week,
               course.period,
               course.classroom || '',
               course.moodle_url || '',
               course.syllabus_url || '',
               course.teams_url || '',
               '',
               '',
               Math.max(0, presentCount),
               Math.max(0, absentCount),
               course.period_count || 1
             ).lastInsertRowid
    const notePath = createNoteRelativePath(course, insertedId)
    writeNoteToFile(notePath, note)
    d.prepare('UPDATE courses SET note_path = ? WHERE id = ?').run(notePath, insertedId)
    return insertedId
  },
  deleteCourse(id) {
    const d = getDb()
    const row = d.prepare('SELECT note_path FROM courses WHERE id = ?').get(id)
    const sessions = d.prepare('SELECT note_path FROM note_sessions WHERE course_id = ?').all(id)
    d.prepare('DELETE FROM courses WHERE id = ?').run(id) // cascades to note_sessions
    deleteNoteFile(row?.note_path)
    for (const s of sessions) deleteNoteFile(s.note_path)
  },
  getNoteSessions(courseId) {
    return getDb()
      .prepare('SELECT * FROM note_sessions WHERE course_id = ? ORDER BY session_number ASC')
      .all(courseId)
  },
  createNoteSession(courseId, course) {
    const d = getDb()
    const last = d.prepare('SELECT MAX(session_number) as max FROM note_sessions WHERE course_id = ?').get(courseId)
    const sessionNumber = (last?.max || 0) + 1
    const notePath = createSessionNotePath(course, courseId, sessionNumber)
    writeNoteToFile(notePath, '')
    const result = d.prepare(
      'INSERT INTO note_sessions (course_id, session_number, note_path, created_at) VALUES (?,?,?,?)'
    ).run(courseId, sessionNumber, notePath, new Date().toISOString())
    return { id: result.lastInsertRowid, course_id: courseId, session_number: sessionNumber, note_path: notePath, created_at: new Date().toISOString() }
  },
  readNoteSession(sessionId) {
    const row = getDb().prepare('SELECT * FROM note_sessions WHERE id = ?').get(sessionId)
    if (!row) return null
    return { ...row, note: readNoteFromFile(row.note_path) }
  },
  saveNoteSession(sessionId, noteText) {
    const row = getDb().prepare('SELECT note_path FROM note_sessions WHERE id = ?').get(sessionId)
    if (!row) return
    writeNoteToFile(row.note_path, noteText)
  },
  deleteNoteSession(sessionId) {
    const row = getDb().prepare('SELECT note_path FROM note_sessions WHERE id = ?').get(sessionId)
    if (row) deleteNoteFile(row.note_path)
    getDb().prepare('DELETE FROM note_sessions WHERE id = ?').run(sessionId)
  },
  getSettings() { return readSettings() },
  saveSettings(settings) { writeSettings(settings) },
  getDefaultNotesDir() { return path.join(app.getPath('userData'), 'notes') },
}

// ===== Electron =====
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  for (const [key, fn] of Object.entries(dbApi)) {
    ipcMain.handle(`db:${key}`, (_, ...args) => fn(...args))
  }
  ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url))
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('shell:openPath', (_, p) => shell.openPath(p))
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
