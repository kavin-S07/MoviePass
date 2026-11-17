// Minimal QR Code SVG generator (byte mode, ECC level M, versions 1-10, mask 0).
// Generates SVG for short strings such as ticket QR identifiers.
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()
const gfMul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0)
const polyMul = (p, q) => {
  const out = new Uint8Array(p.length + q.length - 1)
  for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) out[i + j] ^= gfMul(p[i], q[j])
  return Array.from(out)
}
const polyRest = (dividend, divisor) => {
  const out = dividend.slice()
  for (let i = 0; i <= out.length - divisor.length; i++) {
    if (!out[i]) continue
    for (let j = 1; j < divisor.length; j++) if (divisor[j]) out[i + j] ^= gfMul(divisor[j], out[i])
  }
  return out.slice(out.length - divisor.length + 1)
}
const rsGen = (n) => {
  let g = [1]
  for (let i = 0; i < n; i++) g = polyMul(g, [1, EXP[i]])
  return g
}
// [total, data, ec, align]
const V = [null,[26,16,10,[]],[44,28,16,[6,18]],[70,44,26,[6,22]],[100,64,36,[6,26]],[134,86,48,[6,30]],[172,108,64,[6,34]],[196,122,74,[6,22,38]],[242,152,90,[6,24,42]],[292,180,112,[6,26,46]],[346,216,130,[6,28,50]]]

function encodeData(ver, bytes) {
  const [ , dataCap, ecCap] = V[ver]
  const bits = []
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  push(0b0100, 4)
  push(bytes.length, ver <= 9 ? 8 : 16)
  for (const b of bytes) push(b, 8)
  const maxBits = dataCap * 8
  push(0, Math.min(4, Math.max(0, maxBits - bits.length)))
  while (bits.length % 8) bits.push(0)
  const data = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] || 0)
    data.push(v)
  }
  const pads = [0xec, 0x11]; let p = 0
  while (data.length < dataCap) { data.push(pads[p]); p ^= 1 }
  const ec = polyRest(data.concat(Array(ecCap).fill(0)), rsGen(ecCap))
  return data.concat(ec)
}

function makeMatrix(ver, all) {
  const size = ver * 4 + 17
  const m = Array.from({ length: size }, () => Array(size).fill(null))
  const isRes = Array.from({ length: size }, () => Array(size).fill(false))
  const set = (r, c, v, res = false) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return
    m[r][c] = !!v
    if (res) isRes[r][c] = true
  }

  const finder = (r, c) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const rr = r + y, cc = c + x
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue
        if (y >= 0 && y <= 6 && (x === 0 || x === 6)) set(rr, cc, true, true)
        else if (x >= 0 && x <= 6 && (y === 0 || y === 6)) set(rr, cc, true, true)
        else if (y >= 2 && y <= 4 && x >= 2 && x <= 4) set(rr, cc, true, true)
        else set(rr, cc, false, true)
      }
    }
  }
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7)

  // timing
  for (let i = 8; i < size - 8; i++) {
    if (m[6][i] == null) set(6, i, i % 2 === 0, true)
    if (m[i][6] == null) set(i, 6, i % 2 === 0, true)
  }
  // alignment
  const aligns = V[ver][3] || []
  const canPlaceAlign = (r, c) => {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const rr = r + y, cc = c + x
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) return false
      if (isRes[rr][cc]) return false
    }
    return true
  }
  for (let i = 0; i < aligns.length; i++) for (let j = 0; j < aligns.length; j++) {
    const r = aligns[i], c = aligns[j]
    if (!canPlaceAlign(r, c)) continue
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const on = Math.max(Math.abs(x), Math.abs(y)) !== 1
      set(r + y, c + x, on, true)
    }
  }
  // dark module
  set(size - 8, 8, true, true)
  // reserve format areas
  for (let i = 0; i < 8; i++) {
    if (m[8][i] == null) set(8, i, false, true)
    if (m[i][8] == null) set(i, 8, false, true)
    if (m[8][size - 1 - i] == null) set(8, size - 1 - i, false, true)
    if (m[size - 1 - i][8] == null) set(size - 1 - i, 8, false, true)
  }
  if (m[8][8] == null) set(8, 8, false, true)
  // reserve version areas
  if (ver >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      set(size - 11 + j, i, false, true)
      set(i, size - 11 + j, false, true)
    }
  }

  // data placement
  let bit = 0
  let up = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let i = 0; i < size; i++) {
      const r = up ? size - 1 - i : i
      for (let k = 0; k < 2; k++) {
        const c = col - k
        if (c < 0 || c >= size) continue
        if (isRes[r][c]) continue
        let v = false
        if (bit < all.length * 8) {
          v = ((all[bit >> 3] >>> (7 - (bit & 7))) & 1) === 1
          bit++
        }
        if (((r + c) & 1) === 0) v = !v
        m[r][c] = v
      }
    }
    up = !up
  }
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c] == null) m[r][c] = false

  // format bits (ECC M, mask 0) = 0x5412
  const fmt = 0x5412
  const getFmt = (i) => ((fmt >>> i) & 1) === 1
  const A = [[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],[8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]]
  const B = [[8,size-1],[8,size-2],[8,size-3],[8,size-4],[8,size-5],[8,size-6],[8,size-7],[size-7,8],[size-6,8],[size-5,8],[size-4,8],[size-3,8],[size-2,8],[size-1,8]]
  for (let i = 0; i < 15; i++) {
    const b = getFmt(14 - i)
    set(A[i][0], A[i][1], b, true)
    set(B[i][0], B[i][1], b, true)
  }
  // version info
  if (ver >= 7) {
    const vt = {7:0x07c94,8:0x085bc,9:0x09a99,10:0x0a4d3}[ver] || 0
    for (let i = 0; i < 18; i++) {
      const b = ((vt >>> i) & 1) === 1
      const a = Math.floor(i / 3), bb = i % 3
      set(size - 11 + bb, a, b, true)
      set(a, size - 11 + bb, b, true)
    }
  }
  return { m, size }
}

export function qrToSvg(text, px = 180, margin = 4) {
  const s = String(text || '')
  if (!s) return ''
  const bytes = Array.from(new TextEncoder().encode(s))
  let ver = 1
  while (ver <= 10 && bytes.length > V[ver][1] - 2) ver++
  if (ver > 10) throw new Error('QR payload too large')
  const { m, size } = makeMatrix(ver, encodeData(ver, bytes))
  const dim = size + margin * 2
  const scale = px / dim
  let rects = ''
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) {
    rects += `<rect x="${((c + margin) * scale).toFixed(2)}" y="${((r + margin) * scale).toFixed(2)}" width="${(scale + 0.03).toFixed(2)}" height="${(scale + 0.03).toFixed(2)}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" shape-rendering="crispEdges" role="img" aria-label="Ticket QR code"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g></svg>`
}
