// src/lib/usedImages.ts
// Memoria persistente — registra qué fileIds de Drive ya fueron publicados
// Guarda en /tmp/used_images.json (persiste mientras el servidor corre)
// En producción: reemplazar con una tabla en tu DB o un KV store

import fs from 'fs'
import path from 'path'

const STORE_PATH = path.join(process.cwd(), 'used_images.json')

interface UsedImagesStore {
  // fileId de Drive → { usedAt, brand, postName }
  [fileId: string]: {
    usedAt: string       // ISO date
    brand: string
    postName: string
    month: string        // "2025-05" — para poder limpiar por mes si quieren
  }
}

function readStore(): UsedImagesStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
    }
  } catch {
    // archivo corrupto → empezar vacío
  }
  return {}
}

function writeStore(store: UsedImagesStore): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

/** Marca una imagen como usada */
export function markAsUsed(fileId: string, brand: string, postName: string): void {
  const store = readStore()
  const now = new Date()
  store[fileId] = {
    usedAt: now.toISOString(),
    brand,
    postName,
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  }
  writeStore(store)
}

/** Marca múltiples imágenes como usadas de una vez */
export function markManyAsUsed(
  fileIds: string[],
  brand: string,
  postName: string
): void {
  const store = readStore()
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  for (const fileId of fileIds) {
    store[fileId] = { usedAt: now.toISOString(), brand, postName, month }
  }
  writeStore(store)
}

/** Devuelve true si el fileId ya fue usado */
export function isUsed(fileId: string): boolean {
  const store = readStore()
  return fileId in store
}

/** Filtra una lista de fileIds y devuelve solo los NO usados */
export function filterUnused(fileIds: string[]): string[] {
  const store = readStore()
  return fileIds.filter(id => !(id in store))
}

/** Lista completa de imágenes usadas (para debug/admin) */
export function getAllUsed(): UsedImagesStore {
  return readStore()
}

/** Limpia registros de meses anteriores (opcional — llamar manualmente) */
export function clearOldMonths(keepMonths: string[]): void {
  const store = readStore()
  const cleaned: UsedImagesStore = {}
  for (const [id, meta] of Object.entries(store)) {
    if (keepMonths.includes(meta.month)) cleaned[id] = meta
  }
  writeStore(cleaned)
}
