import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }
const C = {
  g:'#39e0a0', a:'#f0a040', r:'#e85040', b:'#50a0e8', p:'#a060e8',
  y:'#e8d040', t1:'#b8ccd8', t2:'#4a6070', t3:'#28404c', tb:'#dceaf0',
  bg:'#07090b', bg2:'#0c1018', bg3:'#101620', bg4:'#161e28', br:'#1e2c3a',
}

const SOURCE_TYPES = [
  { value:'x_post',       label:'X / Twitter Post' },
  { value:'telegram',     label:'Telegram Channel' },
  { value:'spotter_log',  label:'Spotter / ATC Log' },
  { value:'acars_decode', label:'ACARS Decode' },
  { value:'manual',       label:'Manual Intel Entry' },
  { value:'other',        label:'Other' },
]

const TARGET_TABLES = [
  { value:'amc_flights',         label:'AMC Flights (arrivals/departures)' },
  { value:'stationed_aircraft',  label:'Stationed Aircraft' },
  { value:'sigact_feed',         label:'SIGACT Feed (events)' },
]

// AI parse system prompt — instructs Claude to extract structured data
const PARSE_SYSTEM = `You are a military OSINT data extraction engine for OVERWATCH, a tactical intelligence platform.

Extract structured data from raw OSINT text (social media posts, spotter logs, ACARS decodes, Telegram messages).

Output ONLY valid JSON matching one of these schemas:

For AMC flight data (amc_flights):
{
  "schema": "amc_flights",
  "callsign": "RCH1234",
  "mission_code": "RHCM1234",
  "hex": "AE1234",
  "registration": "00-0181",
  "aircraft_type": "C-17A",
  "origin": "KPOB",
  "destination": "OJMS",
  "dep_date": "2026-04-21",
  "via": "ETAR",
  "mc_flag": "socom|amc|army",
  "status": "COMPLETE|ACTIVE|PENDING",
  "confidence": 0.92
}

For stationed aircraft (stationed_aircraft):
{
  "schema": "stationed_aircraft",
  "asset_id": "EGVA",
  "aircraft_type": "B-52H Stratofortress",
  "unit": "5 BW / Minot AFB",
  "count": 8,
  "count_qualifier": "+",
  "role": "Strategic Bomber",
  "status": "SURGE",
  "tails": ["61-0001", "61-0035"],
  "confirmed": true,
  "confidence": 0.87
}

For SIGACT events (sigact_feed):
{
  "schema": "sigact_feed",
  "content_html": "<b>EGVA</b> 2x B-52H departed for strike package.",
  "location": "EGVA",
  "confidence": 0.75
}

Rules:
- Registration/tail numbers ONLY in the tails array. Never put callsigns in tails.
- Callsigns belong in the callsign field only.
- ICAO codes for airports (4-letter, e.g. EGVA, OJMS).
- If a field cannot be determined, omit it.
- confidence: 0.0-1.0 reflecting how certain you are about the extracted data.
- Output ONLY the JSON object, no preamble, no markdown.`

export function OsintIngest() {
  const [rawText, setRawText]       = useState('')
  const [sourceType, setSourceType] = useState('manual')
  const [sourceUrl, setSourceUrl]   = useState('')
  const [parsing, setParsing]       = useState(false)
  const [parsed, setParsed]         = useState(null)
  const [parseError, setParseError] = useState(null)
  const [queue, setQueue]           = useState([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg]               = useState(null)
  const [selRecord, setSelRecord]   = useState(null)

  useEffect(() => { loadQueue() }, [])

  async function loadQueue() {
    setLoadingQueue(true)
    const { data } = await supabase
      .from('osint_ingest')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setQueue(data || [])
    setLoadingQueue(false)
  }

  function flash(text, err=false) {
    setMsg({ text, err })
    setTimeout(() => setMsg(null), 5000)
  }

  // ── AI Parse ──────────────────────────────────────────────────
  async function parse() {
    if (!rawText.trim()) return
    setParsing(true)
    setParsed(null)
    setParseError(null)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: PARSE_SYSTEM,
          messages: [{ role: 'user', content: rawText }],
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setParsed(parsed)
    } catch(e) {
      setParseError('Parse failed: ' + e.message + '. Check the raw text and try again.')
    } finally {
      setParsing(false)
    }
  }

  // ── Submit to ingest queue ────────────────────────────────────
  async function submitToQueue() {
    if (!rawText.trim()) return
    setSubmitting(true)
    const { error } = await supabase.from('osint_ingest').insert({
      raw_text:    rawText,
      source_type: sourceType,
      source_url:  sourceUrl || null,
      parsed_json: parsed || null,
      target_table: parsed?.schema || null,
      confidence:   parsed?.confidence || null,
      parse_status: parsed ? 'parsed' : 'pending',
      parsed_at:    parsed ? new Date().toISOString() : null,
    })
    setSubmitting(false)
    if (error) { flash('Submit failed: ' + error.message, true); return }
    flash('Submitted to ingest queue')
    setRawText(''); setSourceUrl(''); setParsed(null)
    loadQueue()
  }

  // ── Approve record → push to target table ──────────────────────
  async function approveRecord(record) {
    if (!record.parsed_json || !record.target_table) {
      flash('No parsed data to approve — parse first', true); return
    }
    const p = record.parsed_json
    let error
    if (record.target_table === 'amc_flights') {
      const { error: e } = await supabase.from('amc_flights').insert({
        callsign:      p.callsign,
        mission_code:  p.mission_code,
        hex:           p.hex,
        serial:        p.registration,
        aircraft_type: p.aircraft_type,
        base:          p.origin,
        destination:   p.destination,
        dep_date:      p.dep_date,
        via:           p.via,
        mc_flag:       p.mc_flag || 'amc',
        status:        p.status || 'COMPLETE',
      })
      error = e
    } else if (record.target_table === 'stationed_aircraft') {
      const { error: e } = await supabase.from('stationed_aircraft').insert({
        asset_id:       p.asset_id,
        aircraft_type:  p.aircraft_type,
        unit:           p.unit,
        count:          p.count,
        count_qualifier: p.count_qualifier || null,
        role:           p.role,
        status:         p.status || 'DEPLOYED',
        tails:          p.tails || [],
        confirmed:      p.confirmed ?? true,
      })
      error = e
    } else if (record.target_table === 'sigact_feed') {
      const { error: e } = await supabase.from('sigact_feed').insert({
        content_html: p.content_html,
        location:     p.location,
      })
      error = e
    }
    if (error) { flash('Push failed: ' + error.message, true); return }
    await supabase.from('osint_ingest').update({
      parse_status: 'approved',
      reviewed_at: new Date().toISOString(),
      pushed_at: new Date().toISOString(),
    }).eq('id', record.id)
    flash('Approved and pushed to ' + record.target_table)
    setSelRecord(null)
    loadQueue()
  }

  async function rejectRecord(record) {
    await supabase.from('osint_ingest').update({ parse_status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', record.id)
    setSelRecord(null)
    loadQueue()
  }

  const STATUS_COL = { pending:C.t2, processing:C.y, parsed:C.b, approved:C.g, rejected:C.r }
  const inp = { width:'100%', padding:'8px 10px', background:C.bg, border:`1px solid ${C.br}`, color:C.t1, fontFamily:"'Share Tech Mono',monospace", fontSize:11, outline:'none', borderRadius:1, boxSizing:'border-box' }

  return (
    <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

      {/* LEFT — ingest form */}
      <div style={{ width:420, borderRight:`1px solid ${C.br}`, display:'flex', flexDirection:'column', background:C.bg2, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', background:C.bg4, borderBottom:`1px solid ${C.br}`, flexShrink:0 }}>
          <div style={{ ...R, fontSize:16, fontWeight:700, color:C.tb, marginBottom:2 }}>OSINT Ingest</div>
          <div style={{ ...Z, fontSize:9, color:C.t2, letterSpacing:1 }}>Paste raw intelligence text for AI extraction and structured preview</div>
          {msg && <div style={{ ...Z, fontSize:10, color:msg.err?C.r:C.g, marginTop:8 }}>{msg.err?'✗':''} {msg.text}</div>}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
          {/* Source type */}
          <div>
            <div style={{ ...Z, fontSize:8, color:C.t3, marginBottom:5, letterSpacing:2 }}>SOURCE TYPE</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
              {SOURCE_TYPES.map(s => (
                <div key={s.value} onClick={()=>setSourceType(s.value)}
                  style={{ padding:'6px 8px', cursor:'pointer', borderRadius:1, textAlign:'center',
                    background: sourceType===s.value ? 'rgba(80,160,232,.12)' : C.bg3,
                    border: `1px solid ${sourceType===s.value ? C.b : C.br}` }}>
                  <span style={{ ...R, fontSize:11, fontWeight:600, color: sourceType===s.value ? C.b : C.t2 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Source URL */}
          <div>
            <div style={{ ...Z, fontSize:8, color:C.t3, marginBottom:5, letterSpacing:2 }}>SOURCE URL / REFERENCE (optional)</div>
            <input value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://x.com/..." style={inp} />
          </div>

          {/* Raw text */}
          <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
            <div style={{ ...Z, fontSize:8, color:C.t3, marginBottom:5, letterSpacing:2 }}>RAW INTELLIGENCE TEXT</div>
            <textarea
              value={rawText}
              onChange={e=>setRawText(e.target.value)}
              placeholder="Paste raw text here — X post, Telegram message, spotter log, ACARS decode, manual observation..."
              style={{ ...inp, resize:'none', flex:1, minHeight:200, lineHeight:1.7 }}
            />
            <div style={{ ...Z, fontSize:8, color:C.t3, marginTop:4 }}>
              {rawText.length} chars · {rawText.split(/\s+/).filter(Boolean).length} words
            </div>
          </div>

          {/* Parse result preview */}
          {(parsed || parseError) && (
            <div style={{ background:C.bg, border:`1px solid ${parsed?C.g:C.r}`, borderRadius:1, padding:12 }}>
              <div style={{ ...Z, fontSize:8, letterSpacing:2, color:parsed?C.g:C.r, marginBottom:8 }}>
                {parsed ? 'AI PARSE RESULT' : 'PARSE ERROR'}
              </div>
              {parsed && (
                <>
                  <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                    <span style={{ ...Z, fontSize:9, padding:'2px 6px', background:'rgba(80,160,232,.12)', border:`1px solid ${C.b}`, color:C.b, borderRadius:1 }}>
                      → {parsed.schema || '?'}
                    </span>
                    <span style={{ ...Z, fontSize:9, padding:'2px 6px', background:`${parsed.confidence>=0.8?C.g:parsed.confidence>=0.5?C.a:C.r}18`, color:parsed.confidence>=0.8?C.g:parsed.confidence>=0.5?C.a:C.r, borderRadius:1 }}>
                      {parsed.confidence != null ? `${Math.round(parsed.confidence*100)}% confidence` : 'confidence unknown'}
                    </span>
                  </div>
                  <pre style={{ ...Z, fontSize:9, color:C.t1, lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:200, overflow:'auto', margin:0 }}>
                    {JSON.stringify(parsed, null, 2)}
                  </pre>
                </>
              )}
              {parseError && <div style={{ ...Z, fontSize:10, color:C.r }}>{parseError}</div>}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={parse} disabled={parsing||!rawText.trim()}
              style={{ flex:1, padding:'10px', ...R, fontSize:12, fontWeight:700, letterSpacing:2,
                background: parsing||!rawText.trim() ? C.br : 'rgba(80,160,232,.12)',
                border: `1px solid ${C.b}`, color:C.b, cursor:'pointer', borderRadius:1, opacity: !rawText.trim()?0.5:1 }}>
              {parsing ? 'PARSING...' : 'AI PARSE'}
            </button>
            <button onClick={submitToQueue} disabled={submitting||!rawText.trim()}
              style={{ flex:1, padding:'10px', ...R, fontSize:12, fontWeight:700, letterSpacing:2,
                background: !rawText.trim() ? C.br : C.g,
                border: 'none', color:C.bg, cursor:'pointer', borderRadius:1, opacity: !rawText.trim()?0.5:1 }}>
              {submitting ? 'QUEUING...' : '+ QUEUE'}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT — review queue */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', background:C.bg4, borderBottom:`1px solid ${C.br}`, display:'flex', alignItems:'center', flexShrink:0 }}>
          <span style={{ ...R, fontSize:14, fontWeight:700, color:C.tb }}>Review Queue</span>
          <span style={{ ...Z, fontSize:9, color:C.t2, marginLeft:10 }}>{queue.filter(r=>r.parse_status==='parsed').length} awaiting review</span>
          <button onClick={loadQueue} style={{ ...Z, fontSize:9, padding:'3px 10px', background:'transparent', border:`1px solid ${C.br}`, color:C.t2, cursor:'pointer', borderRadius:1, marginLeft:'auto' }}>↺ REFRESH</button>
        </div>

        <div style={{ flex:1, overflow:'hidden', display:'flex' }}>
          {/* Queue list */}
          <div style={{ width: selRecord ? 280 : undefined, flex: selRecord ? undefined : 1, borderRight: selRecord ? `1px solid ${C.br}` : undefined, overflowY:'auto' }}>
            {loadingQueue ? (
              <div style={{ padding:20, ...Z, fontSize:10, color:C.t3 }}>LOADING...</div>
            ) : queue.length === 0 ? (
              <div style={{ padding:20, ...Z, fontSize:10, color:C.t3 }}>Queue empty.</div>
            ) : queue.map(rec => (
              <div key={rec.id} onClick={()=>setSelRecord(selRecord?.id===rec.id?null:rec)}
                style={{ padding:'10px 14px', cursor:'pointer', borderBottom:`1px solid rgba(30,44,58,.5)`,
                  background: selRecord?.id===rec.id ? 'rgba(80,160,232,.06)' : 'transparent',
                  borderLeft: `3px solid ${STATUS_COL[rec.parse_status]||C.t3}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ ...Z, fontSize:9, padding:'1px 5px', borderRadius:1,
                    background:`${STATUS_COL[rec.parse_status]||C.t3}18`,
                    color:STATUS_COL[rec.parse_status]||C.t3 }}>
                    {rec.parse_status.toUpperCase()}
                  </span>
                  <span style={{ ...Z, fontSize:9, color:C.t2 }}>{rec.source_type}</span>
                  <span style={{ ...Z, fontSize:8, color:C.t3, marginLeft:'auto' }}>
                    {new Date(rec.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
                <div style={{ ...Z, fontSize:10, color:C.t1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {rec.raw_text.slice(0,80)}{rec.raw_text.length>80?'…':''}
                </div>
                {rec.target_table && (
                  <div style={{ ...R, fontSize:9, color:C.b, marginTop:3 }}>→ {rec.target_table}</div>
                )}
                {rec.confidence != null && (
                  <div style={{ ...Z, fontSize:8, color:rec.confidence>=0.8?C.g:rec.confidence>=0.5?C.a:C.r }}>
                    {Math.round(rec.confidence*100)}% confidence
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Record detail + actions */}
          {selRecord && (
            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'12px 16px', background:C.bg4, borderBottom:`1px solid ${C.br}`, display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ ...R, fontSize:13, fontWeight:700, color:C.tb }}>Record Detail</span>
                <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                  {selRecord.parse_status === 'parsed' && (
                    <>
                      <button onClick={()=>approveRecord(selRecord)}
                        style={{ ...R, fontSize:11, fontWeight:700, letterSpacing:1, padding:'6px 18px', background:C.g, color:C.bg, border:'none', cursor:'pointer', borderRadius:1 }}>
                        ✓ APPROVE
                      </button>
                      <button onClick={()=>rejectRecord(selRecord)}
                        style={{ ...Z, fontSize:10, padding:'6px 12px', background:'transparent', border:`1px solid ${C.r}`, color:C.r, cursor:'pointer', borderRadius:1 }}>
                        ✕ REJECT
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ padding:'14px 16px', borderBottom:`1px solid ${C.br}` }}>
                <div style={{ ...Z, fontSize:8, letterSpacing:2, color:C.t3, marginBottom:6 }}>RAW TEXT</div>
                <div style={{ ...Z, fontSize:10, color:C.t1, lineHeight:1.8, whiteSpace:'pre-wrap' }}>{selRecord.raw_text}</div>
              </div>

              {selRecord.source_url && (
                <div style={{ padding:'8px 16px', borderBottom:`1px solid ${C.br}` }}>
                  <a href={selRecord.source_url} target="_blank" rel="noopener noreferrer"
                    style={{ ...Z, fontSize:9, color:C.b }}>↗ {selRecord.source_url}</a>
                </div>
              )}

              {selRecord.parsed_json && (
                <div style={{ padding:'14px 16px', borderBottom:`1px solid ${C.br}` }}>
                  <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
                    <div style={{ ...Z, fontSize:8, letterSpacing:2, color:C.t3 }}>PARSED STRUCTURE</div>
                    <span style={{ ...R, fontSize:10, fontWeight:700, color:C.b }}>→ {selRecord.target_table}</span>
                    {selRecord.confidence != null && (
                      <span style={{ ...Z, fontSize:9, color:selRecord.confidence>=0.8?C.g:selRecord.confidence>=0.5?C.a:C.r, marginLeft:'auto' }}>
                        {Math.round(selRecord.confidence*100)}% confidence
                      </span>
                    )}
                  </div>
                  <pre style={{ ...Z, fontSize:9, color:C.t1, lineHeight:1.6, whiteSpace:'pre-wrap', background:C.bg, padding:10, borderRadius:1, border:`1px solid ${C.br}`, overflow:'auto', maxHeight:300 }}>
                    {JSON.stringify(selRecord.parsed_json, null, 2)}
                  </pre>
                </div>
              )}

              {!selRecord.parsed_json && selRecord.parse_status === 'pending' && (
                <div style={{ padding:20 }}>
                  <div style={{ ...Z, fontSize:10, color:C.t3, marginBottom:12 }}>No parsed data yet. Re-parse:</div>
                  <button onClick={async () => {
                    setRawText(selRecord.raw_text)
                    setSourceType(selRecord.source_type)
                  }} style={{ ...R, fontSize:11, fontWeight:600, padding:'6px 16px', background:'rgba(80,160,232,.1)', border:`1px solid ${C.b}`, color:C.b, cursor:'pointer', borderRadius:1 }}>
                    Load Into Parser
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
