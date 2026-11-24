export const VERSION = 2
export const KEY = 'la-fourmiliere'
export function migrate(record) {
  if (!record || ![1, VERSION].includes(record.version) || !Number.isFinite(record.savedAt)) throw Error('Version inconnue')
  const state = record.state
  if (!state || !Array.isArray(state.ants) || !Array.isArray(state.rooms) || !Array.isArray(state.tunnels)
    || !Array.isArray(state.sources) || !Array.isArray(state.trails) || !Array.isArray(state.brood)
    || !state.portal || !state.stock || !state.fog) throw Error('Sauvegarde incomplète')
  if (!['sugar','protein','earth'].every(key=>Number.isFinite(state.stock[key])) ||
      state.ants.some(ant=>!Number.isFinite(ant.id)||!Number.isFinite(ant.x)||!Number.isFinite(ant.y))) throw Error('Données invalides')
  state.memorial ??= []
  state.missions ??= []
  state.amber ??= 0
  state.finds ??= []
  state.tutorial ??= true
  return {version:VERSION,savedAt:record.savedAt,state}
}
export function readSave(storage = localStorage) {
  for (const key of [KEY, KEY + '.previous']) {
    try {
      const value = storage.getItem(key)
      if (value) return migrate(JSON.parse(value))
    } catch {}
  }
  return null
}
export function writeSave(state, storage = localStorage, now = Date.now()) {
  try {
    const previous = storage.getItem(KEY)
    if (previous) {
      let valid = false
      try { migrate(JSON.parse(previous)); valid = true } catch {}
      if (valid) storage.setItem(KEY + '.previous',previous)
    }
    storage.setItem(KEY,JSON.stringify({version:VERSION,savedAt:now,state}))
    return true
  } catch { return false }
}
export function clearSave(storage = localStorage) {
  storage.removeItem(KEY)
  storage.removeItem(KEY + '.previous')
}
export async function encodeSave(state) {
  const json = JSON.stringify({version:VERSION,savedAt:Date.now(),state})
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
export async function decodeSave(code) {
  const bytes = Uint8Array.from(atob(code.trim()),char=>char.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return migrate(JSON.parse(await new Response(stream).text()))
}