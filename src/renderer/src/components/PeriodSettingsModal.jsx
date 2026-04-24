import { useState, useEffect } from 'react'

const TABS = ['コマの時間', 'その他の設定']

export default function PeriodSettingsModal({ onClose, onSaved }) {
  const [tab, setTab] = useState(0)
  const [periods, setPeriods] = useState([])
  const [saving, setSaving] = useState(false)

  const [notesDir, setNotesDir] = useState('')
  const [defaultNotesDir, setDefaultNotesDir] = useState('')
  const [portalUrl, setPortalUrl] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)

  useEffect(() => {
    window.api.getPeriodSettings().then(setPeriods)
    Promise.all([
      window.api.getSettings(),
      window.api.getDefaultNotesDir(),
    ]).then(([settings, defaultDir]) => {
      setNotesDir(settings.notes_dir || '')
      setPortalUrl(settings.portal_url || '')
      setDefaultNotesDir(defaultDir)
    })
  }, [])

  function update(index, field, value) {
    setPeriods(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  async function handleSavePeriods() {
    if (saving) return
    setSaving(true)
    await window.api.savePeriodSettings(periods)
    onSaved()
    onClose()
  }

  async function handleSelectNotesDir() {
    const dir = await window.api.selectDirectory()
    if (dir) setNotesDir(dir)
  }

  async function handleOpenNotesDir() {
    const dir = notesDir || defaultNotesDir
    await window.api.openPath(dir)
  }

  async function handleSaveSettings() {
    if (settingsSaving) return
    setSettingsSaving(true)
    const current = await window.api.getSettings()
    await window.api.saveSettings({
      ...current,
      notes_dir: notesDir || null,
      portal_url: portalUrl.trim(),
    })
    setSettingsSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>設定</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-tabs">
          {TABS.map((t, i) => (
            <button
              key={i}
              className={`settings-tab ${tab === i ? 'active' : ''}`}
              onClick={() => setTab(i)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {tab === 0 && (
            periods.length === 0 ? (
              <p style={{ color: '#a0aec0', textAlign: 'center', padding: '24px 0' }}>読み込み中...</p>
            ) : (
              <>
                <p className="setup-note" style={{ marginBottom: 16 }}>
                  2限と3限の間は昼休みとして表示されます
                </p>
                <div className="period-settings">
                  {periods.map((p, i) => (
                    <div key={i}>
                      <div className="period-row">
                        <span className="period-label-setup">{p.period_number}限</span>
                        <input
                          type="time"
                          value={p.start_time}
                          onChange={e => update(i, 'start_time', e.target.value)}
                        />
                        <span className="period-separator">〜</span>
                        <input
                          type="time"
                          value={p.end_time}
                          onChange={e => update(i, 'end_time', e.target.value)}
                        />
                      </div>
                      {p.period_number === 2 && periods[i + 1] && (
                        <div className="lunch-break-indicator">
                          昼休み｜{p.end_time} 〜 {periods[i + 1].start_time}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )
          )}

          {tab === 1 && (
            <div className="settings-section">
              <div className="form-group">
                <label>ノートの保存場所</label>
                <div className="dir-input-group">
                  <input
                    type="text"
                    value={notesDir}
                    onChange={e => setNotesDir(e.target.value)}
                    placeholder={defaultNotesDir || 'デフォルト（userData/notes）'}
                    readOnly
                  />
                  <button className="btn-link" type="button" onClick={handleSelectNotesDir}>
                    変更
                  </button>
                  {notesDir && (
                    <button
                      className="btn-secondary"
                      type="button"
                      style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                      onClick={() => setNotesDir('')}
                    >
                      リセット
                    </button>
                  )}
                </div>
                <p className="form-hint">
                  空欄の場合はデフォルト場所（{defaultNotesDir}）に保存されます。
                  変更後は既存ノートが移動されないため、新規保存から反映されます。
                </p>
                <button
                  className="btn-secondary"
                  type="button"
                  style={{ marginTop: 8, fontSize: '0.82rem' }}
                  onClick={handleOpenNotesDir}
                >
                  Finderで開く
                </button>
              </div>

              <div className="form-group" style={{ marginTop: 20 }}>
                <label>大学ポータル URL（l-cam 等）</label>
                <input
                  type="url"
                  value={portalUrl}
                  onChange={e => setPortalUrl(e.target.value)}
                  placeholder="https://..."
                />
                <p className="form-hint">
                  設定するとヘッダーにポータルへのリンクボタンが表示されます。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-footer-right">
            <button className="btn-secondary" onClick={onClose}>キャンセル</button>
            {tab === 0 && (
              <button
                className="btn-primary"
                onClick={handleSavePeriods}
                disabled={periods.length === 0 || saving}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            )}
            {tab === 1 && (
              <button
                className="btn-primary"
                onClick={handleSaveSettings}
                disabled={settingsSaving}
              >
                {settingsSaving ? '保存中...' : '保存'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
