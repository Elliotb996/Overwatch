// src/admin/ImageryUpload.jsx
// Upload satellite / OSINT imagery linked to a base asset
// Files stored in Supabase Storage bucket 'imagery'
// Tier-gated: premium+ see full res, analyst see blurred thumbnail

import { useState } from 'react'
import { supabase, uploadImagery } from '../lib/supabase'

export function ImageryUpload({ assetId, assetName, onUploaded }) {
  const [files,    setFiles]    = useState([])
  const [form,     setForm]     = useState({ source: '', description: '', capture_date: '', tier_required: 'premium' })
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleUpload() {
    if (!files.length) { alert('Select at least one file.'); return }
    if (!form.source)   { alert('Source is required.'); return }

    setUploading(true)
    setProgress(0)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress(Math.round((i / files.length) * 80))

        // 1. Upload to Supabase Storage
        const { path, publicUrl } = await uploadImagery(file, assetId)

        // 2. Insert metadata record
        const { error } = await supabase.from('imagery').insert([{
          asset_id:      assetId,
          capture_date:  form.capture_date || null,
          source:        form.source,
          description:   form.description,
          storage_path:  path,
          tier_required: form.tier_required,
        }])

        if (error) throw error
      }

      setProgress(100)
      setFiles([])
      setForm({ source: '', description: '', capture_date: '', tier_required: 'premium' })
      if (onUploaded) onUploaded()
      alert(`${files.length} image(s) uploaded successfully.`)
    } catch (e) {
      alert('Upload failed: ' + e.message)
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }

  return (
    <div style={{ background: '#0c1018', border: '1px solid #1e2c3a', padding: 16, borderRadius: 2 }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: '#4a6070', fontFamily: 'monospace', marginBottom: 12 }}>
        // UPLOAD IMAGERY — {assetName}
      </div>

      {/* File picker */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 9, letterSpacing: 2, color: '#4a6070', fontFamily: 'monospace', marginBottom: 5 }}>
          FILES (JPG, PNG, TIFF, GeoTIFF)
        </label>
        <input type="file" accept="image/*,.tif,.tiff" multiple
          onChange={e => setFiles(Array.from(e.target.files))}
          style={{ color: '#b8ccd8', fontSize: 11, fontFamily: 'monospace' }} />
        {files.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#50a0e8', fontFamily: 'monospace' }}>
            {files.map(f => f.name).join(', ')}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>SOURCE</label>
          <input value={form.source} onChange={e => set('source', e.target.value)}
            placeholder="Sentinel-2, Planet Labs, OSINT..."
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>CAPTURE DATE</label>
          <input type="date" value={form.capture_date} onChange={e => set('capture_date', e.target.value)}
            style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>DESCRIPTION / NOTES</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
          placeholder="What is visible, areas of interest, context..."
          style={{ ...inputStyle, resize: 'vertical', width: '100%', fontFamily: 'inherit', fontSize: 12 }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>TIER REQUIRED TO VIEW</label>
        <select value={form.tier_required} onChange={e => set('tier_required', e.target.value)}
          style={inputStyle}>
          <option value="analyst">ANALYST+</option>
          <option value="premium">PREMIUM+</option>
          <option value="admin">ADMIN ONLY</option>
        </select>
      </div>

      {uploading && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ background: '#07090b', height: 4, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: progress + '%', height: '100%', background: '#39e0a0', transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 10, color: '#4a6070', fontFamily: 'monospace', marginTop: 4 }}>
            Uploading... {progress}%
          </div>
        </div>
      )}

      <button onClick={handleUpload} disabled={uploading || !files.length}
        style={{ padding: '7px 20px', border: '1px solid #39e0a0', background: uploading ? '#1e2c3a' : 'rgba(57,224,160,.1)', color: '#39e0a0', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, opacity: uploading ? .6 : 1 }}>
        {uploading ? 'UPLOADING...' : `UPLOAD ${files.length || ''} IMAGE${files.length !== 1 ? 'S' : ''}`}
      </button>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 9, letterSpacing: 2, color: '#4a6070',
  fontFamily: 'monospace', marginBottom: 4
}
const inputStyle = {
  width: '100%', background: '#07090b', border: '1px solid #1e2c3a',
  color: '#b8ccd8', padding: '6px 8px', fontFamily: 'monospace', fontSize: 11, outline: 'none'
}
