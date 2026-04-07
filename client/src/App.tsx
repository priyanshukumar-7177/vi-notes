import { useState, useRef, useEffect } from 'react'
import './index.css'

const API = 'http://localhost:5000/api'

interface PasteEvent {
  time: string
  charCount: number
  preview: string
}

interface KeystrokeStats {
  avgSpeed: number
  totalKeystrokes: number
  longPauses: number
}

interface Session {
  _id: string
  createdAt: string
  text: string
  keystrokeStats: KeystrokeStats
  pasteCount: number
}

type Screen = 'login' | 'register' | 'editor'

function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '')
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [pasteEvents, setPasteEvents] = useState<PasteEvent[]>([])
  const [keystrokeStats, setKeystrokeStats] = useState<KeystrokeStats>({
    avgSpeed: 0, totalKeystrokes: 0, longPauses: 0,
  })
  const [sessions, setSessions] = useState<Session[]>([])
  const [savedMsg, setSavedMsg] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  const lastKeyTime = useRef<number | null>(null)
  const intervals = useRef<number[]>([])

  useEffect(() => {
    if (token) {
      setScreen('editor')
      fetchSessions()
    }
  }, [token])

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) setSessions(data)
    } catch (e) {
      console.error('Failed to fetch sessions', e)
    }
  }

  const handleAuth = async (type: 'login' | 'register') => {
    setError('')
    try {
      const res = await fetch(`${API}/auth/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      localStorage.setItem('token', data.token)
      localStorage.setItem('userEmail', data.email)
      setToken(data.token)
      setUserEmail(data.email)
      setScreen('editor')
    } catch {
      setError('Something went wrong')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userEmail')
    setToken('')
    setUserEmail('')
    setScreen('login')
    setText('')
    setPasteEvents([])
    setKeystrokeStats({ avgSpeed: 0, totalKeystrokes: 0, longPauses: 0 })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') e.preventDefault()
    const now = Date.now()
    if (lastKeyTime.current !== null) {
      const interval = now - lastKeyTime.current
      if (interval < 5000) {
        intervals.current.push(interval)
        const avg = intervals.current.reduce((a, b) => a + b, 0) / intervals.current.length
        const cpm = avg > 0 ? Math.round(60000 / avg) : 0
        const longPauses = intervals.current.filter(i => i > 1000).length
        setKeystrokeStats({ avgSpeed: cpm, totalKeystrokes: intervals.current.length + 1, longPauses })
      }
    }
    lastKeyTime.current = now
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text')
    if (!pastedText) return
    setPasteEvents(prev => [{
      time: new Date().toLocaleTimeString(),
      charCount: pastedText.length,
      preview: pastedText.slice(0, 60) + (pastedText.length > 60 ? '...' : ''),
    }, ...prev])
  }

  const handleSave = async () => {
    if (!text.trim()) return
    try {
      const res = await fetch(`${API}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text, keystrokeStats, pasteCount: pasteEvents.length })
      })
      if (res.ok) {
        setText('')
        setPasteEvents([])
        setKeystrokeStats({ avgSpeed: 0, totalKeystrokes: 0, longPauses: 0 })
        lastKeyTime.current = null
        intervals.current = []
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 2000)
        fetchSessions()
      }
    } catch {
      alert('Failed to save session')
    }
  }

  // Auth Screen
  if (screen === 'login' || screen === 'register') {
    return (
      <div className="auth-container">
        <div className="auth-card glass-panel">
          <div className="auth-header">
            <h1 className="auth-title">Vi-Notes</h1>
            <p className="auth-subtitle">
              {screen === 'login' ? 'Welcome back, intelligent thinker.' : 'Join the cognitive workspace.'}
            </p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="input-group">
            <input
              type="email"
              className="input-field"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              type="password"
              className="input-field"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button className="btn-primary" onClick={() => handleAuth(screen)}>
            {screen === 'login' ? 'Authenticate' : 'Initialize Account'}
          </button>

          <p className="auth-switch">
            {screen === 'login' ? "Don't have access? " : 'Already initialized? '}
            <span onClick={() => { setScreen(screen === 'login' ? 'register' : 'login'); setError('') }}>
              {screen === 'login' ? 'Request here' : 'Login here'}
            </span>
          </p>
        </div>
      </div>
    )
  }

  // Editor Screen
  return (
    <div className="layout-main">
      {/* Navbar */}
      <div className="navbar">
        <div className="logo">
          <span className="logo-icon">▲</span> Vi-Notes
        </div>
        <div className="nav-actions">
          {screen === 'editor' && (
            <button 
              className={`btn-icon ${focusMode ? 'active' : ''}`} 
              onClick={() => setFocusMode(!focusMode)}
              title="Toggle Focus Mode"
            >
              {focusMode ? '◎ Focused' : '○ Focus'}
            </button>
          )}
          <span className="user-email">{userEmail}</span>
          <button className="btn-secondary" onClick={handleLogout}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Editor Workspace */}
      <div className={`editor-workspace ${focusMode ? 'focus-mode' : ''}`}>
        
        {/* Floating Background Panels */}
        <div className="panels-wrapper">
          {/* Left Panel: Typing Insights */}
          <div className="floating-panel glass-panel left">
            <h4 className="panel-title">⌨️ Keystroke Intel</h4>
            <div className="stat-row">
              <span className="stat-label">Velocity (CPM)</span>
              <span className="stat-val">{keystrokeStats.avgSpeed}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Keys</span>
              <span className="stat-val">{keystrokeStats.totalKeystrokes}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Micro-pauses</span>
              <span className="stat-val">{keystrokeStats.longPauses}</span>
            </div>
          </div>

          {/* Right Panel: Behavior Analysis */}
          <div className="floating-panel glass-panel right">
            <h4 className="panel-title">🧠 Cognitive State</h4>
            <div className="behavior-text">
              {pasteEvents.length > 2
                ? 'Information Aggregation'
                : keystrokeStats.longPauses > 5
                ? 'Deep Contemplation'
                : 'Fluid Transcription'}
            </div>
            
            <div className="paste-list">
              <h4 className="panel-title" style={{ marginTop: '1.5rem', borderBottom: 'none' }}>📋 Clipboard Feed</h4>
              {pasteEvents.length === 0 ? (
                <div className="stat-label">No external data imported.</div>
              ) : (
                pasteEvents.slice(0, 3).map((p, i) => (
                  <div key={i} className="paste-item">
                    <span>{p.time}</span>
                    <span style={{ color: '#fff' }}>{p.charCount} chars</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Central Writing Card */}
        <div className="writing-card glass-panel">
          <textarea
            className="editor-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Record your thoughts seamlessly..."
          />
          <div className="editor-footer">
            <div className="metrics-group">
              <span className="char-count">{text.length} chars</span>
              <span className="char-count divider">•</span>
              <span className="char-count">{wordCount} words</span>
            </div>
            <button
              className="btn-primary"
              style={{ width: 'auto', padding: '0.75rem 2rem' }}
              onClick={handleSave}
              disabled={!text.trim()}
            >
              {savedMsg ? 'Stored ✓' : 'Commit Data'}
            </button>
          </div>
        </div>

      </div>

      {/* Persistent History Strip */}
      <div className={`history-strip ${focusMode ? 'hidden' : ''}`}>
        {sessions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', margin: '0 auto' }}>
            No prior cognitive sessions recorded.
          </p>
        ) : (
          sessions.map(s => (
             <div key={s._id} className="history-item">
              <span className="history-time">
                {new Date(s.createdAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </span>
              <p className="history-text">
                {s.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default App