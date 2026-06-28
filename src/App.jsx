import { useState, useEffect, useCallback } from 'react'
import './App.css'

const API = 'https://kiosco-ai.onrender.com'
const PASSWORD = 'gelline2024'
const REFRESH_INTERVAL = 30000

const COSTO_INPUT  = 0.000003
const COSTO_OUTPUT = 0.000015
const PRESUPUESTO  = 5.00

function Login({ onLogin }) {
  const [pass, setPass] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (pass === PASSWORD) { onLogin() }
    else { setError(true); setPass('') }
  }

  return (
    <div style={{ background: '#0F1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#161B27', border: '0.5px solid #1F2937', borderRadius: 16, padding: '2rem', width: 300 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Gelline <span style={{ color: '#2D9E75' }}>Admin</span></div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 24 }}>Panel de supervisión</div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pass}
            onChange={e => { setPass(e.target.value); setError(false) }}
            placeholder="Contraseña"
            style={{ width: '100%', padding: '10px 12px', background: '#0F1117', border: `0.5px solid ${error ? '#EF4444' : '#1F2937'}`, borderRadius: 8, color: '#E5E7EB', fontSize: 14, outline: 'none', marginBottom: 8 }}
          />
          {error && <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 8 }}>Contraseña incorrecta</div>}
          <button type="submit" style={{ width: '100%', padding: '10px', background: '#2D6A4F', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}

function Badge({ tipo }) {
  const map = {
    stock:    { bg: '#1C0A0A', color: '#EF4444' },
    venta:    { bg: '#052E16', color: '#10B981' },
    consulta: { bg: '#1C1A00', color: '#F59E0B' },
    neutral:  { bg: '#1F2937', color: '#6B7280' },
  }
  const s = map[tipo] || map.neutral
  return <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: s.bg, color: s.color }}>{tipo}</span>
}

function clasificar(texto) {
  const t = texto.toLowerCase()
  if (t.includes('no tenés') || t.includes('no hay') || t.includes('no me quedó') || t.includes('stock')) return 'stock'
  if (t.includes('me llevo') || t.includes('pago') || t.includes('tarjeta') || t.includes('efectivo') || t.includes('me lo envuelve')) return 'venta'
  if (t.includes('cuánto') || t.includes('tienen') || t.includes('busco') || t.includes('querría')) return 'consulta'
  return 'neutral'
}

export default function App() {
  const [auth,            setAuth]            = useState(() => sessionStorage.getItem('gelline_admin') === 'true')
  const [tab,             setTab]             = useState('panel')
  const [status,          setStatus]          = useState(null)
  const [transcripciones, setTranscripciones] = useState([])
  const [decisiones,      setDecisiones]      = useState(null)
  const [tokensHoy,       setTokensHoy]       = useState(0)
  const [gastoHoy,        setGastoHoy]        = useState(0)
  const [loading,         setLoading]         = useState(true)
  const [ultimoUpdate,    setUltimoUpdate]    = useState(null)
  const [pausado,         setPausado]         = useState(false)
  const [busqueda,        setBusqueda]        = useState('')

  function handleLogin() {
    sessionStorage.setItem('gelline_admin', 'true')
    setAuth(true)
  }

  const fetchAll = useCallback(async () => {
    try {
      const [resStatus, resTx, resDec] = await Promise.all([
        fetch(`${API}/admin/status`),
        fetch(`${API}/admin/transcripciones`),
        fetch(`${API}/decisiones`),
      ])
      if (resStatus.ok) {
        const d = await resStatus.json()
        setStatus(d)
        setPausado(!d.activo)
      }
      if (resTx.ok) {
        const d = await resTx.json()
        setTranscripciones(d.transcripciones || [])
        const chars = (d.transcripciones || []).reduce((acc, t) => acc + t.chars, 0)
        const tokens_est = Math.round(chars / 4)
        setTokensHoy(tokens_est)
        setGastoHoy(parseFloat((tokens_est * COSTO_INPUT).toFixed(4)))
      }
      if (resDec.ok) {
        const d = await resDec.json()
        setDecisiones(d.decisiones)
      }
      setUltimoUpdate(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!auth) return
    fetchAll()
    const id = setInterval(fetchAll, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [auth, fetchAll])

  async function togglePausa() {
    try {
      const res = await fetch(`${API}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activo: pausado,
          apertura: '09:00',
          cierre: '20:00',
          descanso: false,
          descanso_inicio: '13:00',
          descanso_fin: '14:00',
          saludo_automatico: false,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPausado(!data.activo)
        await fetchAll()
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (!auth) return <Login onLogin={handleLogin} />

  const pct = Math.min((gastoHoy / PRESUPUESTO) * 100, 100)
  const quedan = (PRESUPUESTO - gastoHoy).toFixed(2)
  const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'

  const txFiltradas = transcripciones.filter(t =>
    busqueda === '' || t.texto.toLowerCase().includes(busqueda.toLowerCase())
  )

  const s        = { background: '#0F1117', minHeight: '100vh', color: '#E5E7EB', padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif' }
  const card     = { background: '#161B27', border: '0.5px solid #1F2937', borderRadius: 10, padding: 14, marginBottom: 12 }
  const seccion  = { fontSize: 10, fontWeight: 600, color: '#4B5563', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }
  const statCard = { background: '#161B27', border: '0.5px solid #1F2937', borderRadius: 10, padding: 12 }

  return (
    <div style={s}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '0.5px solid #1F2937' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Gelline <span style={{ color: '#2D9E75' }}>Admin</span></div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>
            Boutique Piloto #1 · {ultimoUpdate ? `actualizado hace ${Math.round((Date.now() - ultimoUpdate) / 1000)}s` : 'cargando...'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={togglePausa} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '0.5px solid #374151', background: 'transparent', color: '#9CA3AF', cursor: 'pointer' }}>
            {pausado ? '▶ Reanudar' : '⏸ Pausar Claude'}
          </button>
          <button onClick={() => { sessionStorage.clear(); setAuth(false) }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#7F1D1D', color: '#FCA5A5', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '0.5px solid #1F2937', paddingBottom: 0 }}>
        {['panel', 'transcripciones', 'decisiones'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ fontSize: 13, padding: '8px 16px', color: tab === t ? '#10B981' : '#6B7280', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${tab === t ? '#10B981' : 'transparent'}`, marginBottom: -1, textTransform: 'capitalize' }}>
            {t === 'panel' ? 'Panel' : t === 'transcripciones' ? 'Transcripciones' : 'Dashboard cliente'}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: '#4B5563', fontSize: 13 }}>Cargando...</div>}

      {!loading && tab === 'panel' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Android', val: status?.debe_grabar ? 'Activo' : 'En pausa', sub: status?.dia_hoy || '-', color: status?.debe_grabar ? '#10B981' : '#F59E0B' },
              { label: 'Fragmentos hoy', val: status?.fragmentos_hoy ?? '-', sub: `${status?.chars_hoy ?? 0} chars` },
              { label: 'Tokens est.', val: tokensHoy.toLocaleString(), sub: `$${gastoHoy} gastado` },
              { label: 'Último audio', val: status?.ultimo_audio ? status.ultimo_audio.split(' ')[1].slice(0,5) : '-', sub: status?.primer_audio ? `desde ${status.primer_audio.split(' ')[1].slice(0,5)}` : '-' },
            ].map((item, i) => (
              <div key={i} style={statCard}>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: item.color || '#F9FAFB' }}>{item.val}</div>
                <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{item.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={seccion}>Presupuesto Claude</div>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>Gastado</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: barColor }}>${gastoHoy}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>Quedan</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#F9FAFB' }}>${quedan}</div>
                  </div>
                </div>
                <div style={{ background: '#1F2937', borderRadius: 99, height: 8, marginBottom: 4 }}>
                  <div style={{ width: `${pct}%`, height: 8, borderRadius: 99, background: barColor, transition: 'width .4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4B5563' }}>
                  <span>$0</span><span style={{ color: '#F59E0B' }}>⚠ $3.50</span><span style={{ color: '#EF4444' }}>✕ $4.50</span><span>$5.00</span>
                </div>
              </div>

              <div style={seccion}>Horario hoy</div>
              <div style={card}>
                {status && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '0.5px solid #1F2937' }}>
                      <span style={{ color: '#6B7280' }}>Día</span>
                      <span style={{ textTransform: 'capitalize' }}>{status.dia_hoy}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '0.5px solid #1F2937' }}>
                      <span style={{ color: '#6B7280' }}>Estado</span>
                      <span style={{ color: status.debe_grabar ? '#10B981' : '#F59E0B' }}>
                        {status.debe_grabar ? 'Grabando' : status.activo ? 'Fuera de horario' : 'Pausado'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0' }}>
                      <span style={{ color: '#6B7280' }}>Config</span>
                      <span>{status.horario_hoy?.tipo === 'custom' ? 'Personalizada' : 'General'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <div style={seccion}>Transcripciones recientes</div>
              <div style={{ ...card, maxHeight: 340, overflowY: 'auto' }}>
                {transcripciones.slice(-5).reverse().map((t, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: i < 4 ? '0.5px solid #1F2937' : 'none' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#4B5563', fontFamily: 'monospace' }}>{t.timestamp.split(' ')[1]?.slice(0,5)}</span>
                      <span style={{ fontSize: 10, color: '#374151', background: '#1F2937', padding: '1px 6px', borderRadius: 99 }}>{t.chars} chars</span>
                      <Badge tipo={clasificar(t.texto)} />
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>
                      {t.texto.length > 120 ? t.texto.slice(0, 120) + '...' : t.texto}
                    </div>
                  </div>
                ))}
                {transcripciones.length === 0 && <div style={{ fontSize: 12, color: '#4B5563' }}>Sin transcripciones hoy</div>}
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'transcripciones' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Fragmentos', val: transcripciones.length },
              { label: 'Total chars', val: (status?.chars_hoy || 0).toLocaleString() },
              { label: 'Primer audio', val: status?.primer_audio?.split(' ')[1]?.slice(0,5) || '-' },
              { label: 'Último audio', val: status?.ultimo_audio?.split(' ')[1]?.slice(0,5) || '-' },
            ].map((item, i) => (
              <div key={i} style={statCard}>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#F9FAFB' }}>{item.val}</div>
              </div>
            ))}
          </div>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar en transcripciones..."
            style={{ width: '100%', padding: '8px 12px', background: '#161B27', border: '0.5px solid #1F2937', borderRadius: 8, color: '#E5E7EB', fontSize: 13, outline: 'none', marginBottom: 12 }}
          />
          <div style={card}>
            {txFiltradas.slice().reverse().map((t, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < txFiltradas.length - 1 ? '0.5px solid #1F2937' : 'none' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#4B5563', fontFamily: 'monospace' }}>{t.timestamp.split(' ')[1]}</span>
                  <span style={{ fontSize: 10, color: '#374151', background: '#1F2937', padding: '1px 6px', borderRadius: 99 }}>{t.chars} chars</span>
                  <Badge tipo={clasificar(t.texto)} />
                </div>
                <div style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.6 }}>{t.texto}</div>
              </div>
            ))}
            {txFiltradas.length === 0 && <div style={{ fontSize: 12, color: '#4B5563' }}>Sin resultados</div>}
          </div>
        </>
      )}

      {!loading && tab === 'decisiones' && (
        <div style={card}>
          {decisiones
            ? <pre style={{ fontSize: 13, color: '#D1D5DB', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{decisiones}</pre>
            : <div style={{ fontSize: 12, color: '#4B5563' }}>No hay decisiones generadas hoy</div>
          }
        </div>
      )}
    </div>
  )
}
