// src/components/GlobeLoader.jsx
// Monochrome spinning globe with real country outlines + whirl effect.
// Matches OVERWATCH palette: #07090b bg, #39e0a0 accent.
// Usage:  <GlobeLoader size={200} />     (defaults match the login bg)
//         <GlobeLoader size={120} bg="#0c1018" />   (inside panels)

import { useEffect, useRef } from 'react'

const COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Cache the decoded rings so every instance after the first is instant
let _ringsPromise = null
function loadRings() {
  if (_ringsPromise) return _ringsPromise
  _ringsPromise = fetch(COUNTRIES_URL).then(r => r.json()).then(decodeCountries).catch(() => [])
  return _ringsPromise
}

function decodeArcs(topology) {
  const { transform, arcs } = topology
  const [kx, ky] = transform.scale
  const [dx, dy] = transform.translate
  return arcs.map(arc => {
    let x = 0, y = 0
    const out = new Array(arc.length)
    for (let i = 0; i < arc.length; i++) {
      x += arc[i][0]; y += arc[i][1]
      out[i] = [x * kx + dx, y * ky + dy]
    }
    return out
  })
}
function arcRings(arcIndices, decodedArcs) {
  const ring = []
  for (let i = 0; i < arcIndices.length; i++) {
    const idx = arcIndices[i]
    const arc = idx < 0 ? decodedArcs[~idx].slice().reverse() : decodedArcs[idx]
    if (i > 0) ring.push(...arc.slice(1))
    else ring.push(...arc)
  }
  return ring
}
function decodeCountries(topo) {
  const arcs = decodeArcs(topo)
  const rings = []
  for (const g of topo.objects.countries.geometries) {
    if (g.type === 'Polygon') {
      for (const a of g.arcs) rings.push(arcRings(a, arcs))
    } else if (g.type === 'MultiPolygon') {
      for (const p of g.arcs) for (const a of p) rings.push(arcRings(a, arcs))
    }
  }
  return rings
}

function project(lon, lat, rotY, cx, cy, r) {
  const φ = lat * Math.PI / 180
  const λ = lon * Math.PI / 180 + rotY
  const x = Math.cos(φ) * Math.sin(λ)
  const y = Math.sin(φ)
  const z = Math.cos(φ) * Math.cos(λ)
  return { x: cx + r * x, y: cy - r * y, z }
}

function isDark(c) {
  if (!c) return true
  const m = c.match(/^#([0-9a-f]{6})$/i) || c.match(/^#([0-9a-f]{3})$/i)
  let r, g, b
  if (m) {
    const h = m[1]
    if (h.length === 6) { r = parseInt(h.slice(0,2),16); g = parseInt(h.slice(2,4),16); b = parseInt(h.slice(4,6),16) }
    else { r = parseInt(h[0]+h[0],16); g = parseInt(h[1]+h[1],16); b = parseInt(h[2]+h[2],16) }
  } else {
    const rm = c.match(/rgba?\(([^)]+)\)/i); if (!rm) return true
    ;[r,g,b] = rm[1].split(',').map(s => parseFloat(s))
  }
  return (0.2126*r + 0.7152*g + 0.0722*b) < 90
}

export function GlobeLoader({ size = 200, bg = '#07090b', accent = '#39e0a0', speed = 0.22, style }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = size + 'px'
    canvas.style.height = size + 'px'
    ctx.scale(dpr, dpr)

    const dark = isDark(bg)
    const ink = dark ? '#b8ccd8' : '#0b0f14'
    const ringFaint  = dark ? 'rgba(184,204,216,0.18)' : 'rgba(7,9,11,0.12)'
    const ringStrong = dark ? 'rgba(184,204,216,0.55)' : 'rgba(7,9,11,0.55)'
    const graticule  = dark ? 'rgba(57,224,160,0.14)'  : 'rgba(7,9,11,0.14)'

    let rings = []
    let cancelled = false
    let raf = 0
    const t0 = performance.now()

    loadRings().then(r => { if (!cancelled) rings = r })

    function draw(now) {
      const t = (now - t0) / 1000
      const cx = size / 2, cy = size / 2
      const R = size * 0.38
      const rotY = t * speed

      ctx.clearRect(0, 0, size, size)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, size, size)

      // faint outer ring
      ctx.save()
      ctx.strokeStyle = ringFaint
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, R + 16, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()

      // accent rotating dashed arc
      ctx.save()
      ctx.translate(cx, cy); ctx.rotate(t * 1.2)
      ctx.strokeStyle = accent; ctx.lineWidth = 1.25; ctx.setLineDash([2, 5])
      ctx.beginPath(); ctx.arc(0, 0, R + 16, -Math.PI * 0.35, Math.PI * 0.35); ctx.stroke()
      ctx.restore()

      // counter-rotating ink arc
      ctx.save()
      ctx.translate(cx, cy); ctx.rotate(-t * 0.7)
      ctx.strokeStyle = ringStrong; ctx.lineWidth = 1.25; ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.arc(0, 0, R + 10, Math.PI * 0.75, Math.PI * 1.25); ctx.stroke()
      ctx.restore()

      // orbiting tick + trail
      const orbR = R + 16, orbA = t * 1.8
      ctx.save()
      ctx.fillStyle = accent
      ctx.beginPath(); ctx.arc(cx + Math.cos(orbA) * orbR, cy + Math.sin(orbA) * orbR, 2.2, 0, Math.PI * 2); ctx.fill()
      for (let i = 1; i <= 6; i++) {
        const a = orbA - i * 0.04
        ctx.fillStyle = `rgba(57,224,160,${0.35 - i * 0.05})`
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * orbR, cy + Math.sin(a) * orbR, 1.6, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()

      // globe disc + clipped contents
      ctx.save()
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = bg; ctx.fill(); ctx.clip()

      ctx.strokeStyle = graticule; ctx.lineWidth = 0.75
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath(); let first = true
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = project(lon, lat, rotY, cx, cy, R)
          if (p.z < 0) { first = true; continue }
          if (first) { ctx.moveTo(p.x, p.y); first = false } else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      }
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath(); let first = true
        for (let lat = -90; lat <= 90; lat += 4) {
          const p = project(lon, lat, rotY, cx, cy, R)
          if (p.z < 0) { first = true; continue }
          if (first) { ctx.moveTo(p.x, p.y); first = false } else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      }

      if (rings.length) {
        ctx.strokeStyle = ink; ctx.lineWidth = 0.9
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'
        for (const ring of rings) {
          ctx.beginPath(); let drawing = false
          for (let i = 0; i < ring.length; i++) {
            const [lon, lat] = ring[i]
            const p = project(lon, lat, rotY, cx, cy, R)
            if (p.z < 0.02) { drawing = false; continue }
            if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true } else ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()
        }
      }
      ctx.restore()

      // globe outline
      ctx.strokeStyle = ink; ctx.lineWidth = 1.25
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()

      if (!cancelled) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [size, bg, accent, speed])

  return <canvas ref={ref} style={style} />
}
