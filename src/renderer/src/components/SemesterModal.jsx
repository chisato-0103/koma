import { useState } from 'react'

export default function SemesterModal({ semesters, activeSemester, onSelect, onUpdate, onClose }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (creating || !newName.trim()) {
      if (!newName.trim()) setError('学期名を入力してください')
      return
    }
    setCreating(true)
    const id = await window.api.createSemester(newName.trim())
    if (semesters.length === 0) {
      await window.api.setActiveSemester(id)
    }
    setNewName('')
    setError('')
    setCreating(false)
    await onUpdate()
  }

  async function handleDelete(id) {
    if (activeSemester?.id === id) {
      alert('現在選択中の学期は削除できません')
      return
    }
    if (confirm('この学期と授業データをすべて削除しますか？')) {
      await window.api.deleteSemester(id)
      await onUpdate()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>学期管理</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="semester-list">
            {semesters.length === 0 && (
              <p className="empty-text">学期がありません</p>
            )}
            {semesters.map(s => (
              <div
                key={s.id}
                className={`semester-item ${activeSemester?.id === s.id ? 'active' : ''}`}
              >
                <span className="semester-name" onClick={() => onSelect(s)}>
                  {s.name}
                  {activeSemester?.id === s.id && (
                    <span className="active-badge">選択中</span>
                  )}
                </span>
                <button className="btn-danger-sm" onClick={() => handleDelete(s.id)}>
                  削除
                </button>
              </div>
            ))}
          </div>

          <div className="create-semester">
            <h3>新しい学期を作成</h3>
            <div className="url-input-group">
              <input
                type="text"
                value={newName}
                onChange={e => { setNewName(e.target.value); setError('') }}
                placeholder="例：2024年後期"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <button className="btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? '作成中...' : '作成'}
              </button>
            </div>
            {error && <p className="error-text">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
