import { useState } from 'react'

const DEFAULT_PERIODS = [
  { period_number: 1, start_time: '08:50', end_time: '10:30' },
  { period_number: 2, start_time: '10:40', end_time: '12:20' },
  { period_number: 3, start_time: '13:10', end_time: '14:50' },
  { period_number: 4, start_time: '15:00', end_time: '16:40' },
  { period_number: 5, start_time: '16:50', end_time: '18:30' },
  { period_number: 6, start_time: '18:40', end_time: '20:20' },
]

export default function Setup({ onComplete }) {
  const [step, setStep] = useState(1)
  const [periods, setPeriods] = useState(DEFAULT_PERIODS)
  const [semesterName, setSemesterName] = useState(`${new Date().getFullYear()}年前期`)
  const [error, setError] = useState('')

  function updatePeriod(index, field, value) {
    setPeriods(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  const [submitting, setSubmitting] = useState(false)

  async function handleFinish() {
    if (submitting) return
    if (!semesterName.trim()) {
      setError('学期名を入力してください')
      return
    }
    setSubmitting(true)
    await window.api.savePeriodSettings(periods)
    const id = await window.api.createSemester(semesterName.trim())
    await window.api.setActiveSemester(id)
    onComplete()
  }

  return (
    <div className="setup-container">
      <div className="setup-card">
        <h1 className="setup-title">初期設定</h1>
        <p className="setup-subtitle">アプリを使い始める前に設定をしましょう</p>

        {step === 1 && (
          <>
            <h2 className="setup-section-title">各限の時間を設定</h2>
            <p className="setup-note">後から設定画面で変更できます</p>
            <div className="period-settings">
              {periods.map((p, i) => (
                <div key={i} className="period-row">
                  <span className="period-label-setup">{p.period_number}限</span>
                  <input
                    type="time"
                    value={p.start_time}
                    onChange={e => updatePeriod(i, 'start_time', e.target.value)}
                  />
                  <span className="period-separator">〜</span>
                  <input
                    type="time"
                    value={p.end_time}
                    onChange={e => updatePeriod(i, 'end_time', e.target.value)}
                  />
                </div>
              ))}
            </div>
            <button className="btn-primary btn-full" onClick={() => setStep(2)}>
              次へ →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="setup-section-title">最初の学期を作成</h2>
            <div className="form-group">
              <label>学期名</label>
              <input
                type="text"
                value={semesterName}
                onChange={e => { setSemesterName(e.target.value); setError('') }}
                placeholder="例：2024年前期"
                autoFocus
              />
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="setup-buttons">
              <button className="btn-secondary" onClick={() => setStep(1)}>← 戻る</button>
              <button className="btn-primary" onClick={handleFinish} disabled={submitting}>
                {submitting ? '保存中...' : '完了'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
