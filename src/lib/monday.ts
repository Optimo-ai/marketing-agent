// Monday.com GraphQL API client

const MONDAY_API_URL = 'https://api.monday.com/v2'

async function mondayQuery(query: string, variables?: Record<string, unknown>) {
  const apiKey = process.env.MONDAY_API_KEY || ''
  if (!apiKey || apiKey.length < 20) {
    throw new Error('MONDAY_API_KEY no configurada. Ve a Monday.com → Perfil → Administration → API → Personal API Token y actualiza .env.local')
  }
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json()
  if (data.errors) throw new Error(data.errors[0].message)
  return data.data
}

async function getDefaultWorkspaceId(): Promise<string | null> {
  // Try multiple approaches — the "Main" workspace often doesn't appear in workspaces()
  try {
    // Approach 1: list non-default workspaces
    const data = await mondayQuery(`query { workspaces(limit: 10) { id name } }`)
    const ws = data?.workspaces
    if (ws && ws.length > 0) return String(ws[0].id)
  } catch {}

  try {
    // Approach 2: get workspace_id from an existing board
    const data = await mondayQuery(`query { boards(limit: 1, board_kind: public) { workspace { id } } }`)
    const wsId = data?.boards?.[0]?.workspace?.id
    if (wsId) return String(wsId)
  } catch {}

  // Approach 3: return null — callers will create board without workspace_id (goes to Main)
  return null
}

// ─── BOARD COLUMNS MAP ────────────────────────────────────────────────────────
// Column IDs returned after board creation — used to set item values

export interface BoardColumns {
  formato?: string
  proyecto?: string
  plataformas?: string
  semana?: string
  dia?: string
  direccion?: string
  copy_ig?: string
  copy_fb?: string
  copy_li?: string
  copy_gmb?: string
  fecha_programada?: string
  hora?: string
  // Nuevas columnas para tracking
  url_design?: string
  status_design?: string
  copy_aprobado?: string
  status_schedule?: string
}

function mapColumnsByTitle(columns: { id: string; title: string }[]): BoardColumns {
  const by: Record<string, string> = {}
  for (const c of columns) by[c.title.toLowerCase().trim()] = c.id
  return {
    formato:          by['formato']                       ?? by['format']     ?? '',
    proyecto:         by['proyecto']                      ?? by['project']    ?? '',
    plataformas:      by['plataformas']                   ?? by['platforms']  ?? '',
    semana:           by['semana']                        ?? by['week']       ?? '',
    dia:              by['día sugerido']                  ?? by['dia']        ?? '',
    direccion:        by['dirección de contenido']        ?? by['direccion']  ?? '',
    copy_ig:          by['copy ig']                       ?? '',
    copy_fb:          by['copy fb']                       ?? '',
    copy_li:          by['copy li']                       ?? '',
    copy_gmb:         by['copy gmb']                      ?? '',
    fecha_programada: by['fecha programada']              ?? '',
    hora:             by['hora']                          ?? '',
    url_design:       by['url diseño']                    ?? by['url design'] ?? '',
    status_design:    by['status diseño']                 ?? by['design status'] ?? '',
    copy_aprobado:    by['copy aprobado']                 ?? by['approved copy'] ?? '',
    status_schedule:  by['status programación']           ?? by['schedule status'] ?? '',
  }
}

// ─── BOARD MANAGEMENT ─────────────────────────────────────────────────────────

export async function getMarketingBoards(workspaceId?: string) {
  const wsId = workspaceId || await getDefaultWorkspaceId()

  if (wsId) {
    try {
      const data = await mondayQuery(`
        query($ws: [ID!]) {
          boards(workspace_ids: $ws, limit: 50) {
            id name columns { id title type }
          }
        }
      `, { ws: [wsId] })
      if (data.boards?.length > 0) return data.boards
    } catch {}
  }

  // Fallback: search all boards (works when Main workspace has no ID)
  const data = await mondayQuery(`
    query {
      boards(limit: 50, board_kind: public) {
        id name columns { id title type }
      }
    }
  `)
  return data.boards || []
}

export async function findBoard(namePattern: string, _workspaceId?: string) {
  // Always use dynamic workspace ID — ignore stale env var
  const boards = await getMarketingBoards()
  return boards.find((b: { name: string }) =>
    b.name.toLowerCase().includes(namePattern.toLowerCase())
  ) || null
}

export async function createBoard(name: string, _workspaceId?: string) {
  const wsId = await getDefaultWorkspaceId()

  // If we have a workspace ID use it; otherwise create in Main workspace (no workspace_id arg)
  const data = wsId
    ? await mondayQuery(`
        mutation($wsId: ID!, $name: String!) {
          create_board(board_name: $name, board_kind: public, workspace_id: $wsId) { id }
        }
      `, { wsId, name })
    : await mondayQuery(`
        mutation($name: String!) {
          create_board(board_name: $name, board_kind: public) { id }
        }
      `, { name })

  return data.create_board
}

// Creates a calendar board with structured columns (or returns existing one).
// Never creates a duplicate for the same month — checks by exact board name first.
export async function createOrGetCalendarBoard(boardName: string): Promise<{ id: string; columns: BoardColumns }> {
  const wsId = await getDefaultWorkspaceId()  // may be null → uses Main workspace

  // Check if board already exists (prevents duplicates per month)
  const existing = await getMarketingBoards(wsId ?? undefined)
  const found = existing.find((b: any) =>
    b.name.toLowerCase().trim() === boardName.toLowerCase().trim()
  )
  if (found) {
    console.log(`[monday] Board "${boardName}" already exists (id: ${found.id}) — reusing`)
    return { id: found.id, columns: mapColumnsByTitle(found.columns ?? []) }
  }

  // Create new board — with or without workspace_id
  const createRes = wsId
    ? await mondayQuery(`
        mutation($wsId: ID!, $name: String!) {
          create_board(board_name: $name, board_kind: public, workspace_id: $wsId) { id }
        }
      `, { wsId, name: boardName })
    : await mondayQuery(`
        mutation($name: String!) {
          create_board(board_name: $name, board_kind: public) { id }
        }
      `, { name: boardName })

  const boardId = createRes.create_board.id
  console.log(`[monday] Created board "${boardName}" (id: ${boardId})`)

  // Create custom columns sequentially (Monday rate-limits parallel mutations)
  const colDefs = [
    { title: 'Formato',                  type: 'text' as const },
    { title: 'Proyecto',                 type: 'text' as const },
    { title: 'Plataformas',              type: 'text' as const },
    { title: 'Semana',                   type: 'numbers' as const },
    { title: 'Día sugerido',             type: 'text' as const },
    { title: 'Dirección de contenido',   type: 'long_text' as const },
    { title: 'Copy IG',                  type: 'long_text' as const },
    { title: 'Copy FB',                  type: 'long_text' as const },
    { title: 'Copy LI',                  type: 'long_text' as const },
    { title: 'Copy GMB',                 type: 'long_text' as const },
    { title: 'Fecha programada',         type: 'date' as const },
    { title: 'Hora',                     type: 'text' as const },
    { title: 'URL Diseño',               type: 'link' as const },
    { title: 'Status Diseño',            type: 'status' as const },
    { title: 'Copy Aprobado',            type: 'long_text' as const },
    { title: 'Status Programación',      type: 'status' as const },
  ]

  const createdIds: Record<string, string> = {}
  for (const col of colDefs) {
    try {
      const colRes = await mondayQuery(`
        mutation($boardId: ID!, $title: String!, $type: ColumnType!) {
          create_column(board_id: $boardId, title: $title, column_type: $type) {
            id title
          }
        }
      `, { boardId, title: col.title, type: col.type })
      createdIds[col.title] = colRes.create_column.id
      await new Promise(r => setTimeout(r, 120))
    } catch (err) {
      console.warn(`[monday] Column "${col.title}" error:`, err)
    }
  }

  return {
    id: boardId,
    columns: {
      formato:          createdIds['Formato']               ?? '',
      proyecto:         createdIds['Proyecto']              ?? '',
      plataformas:      createdIds['Plataformas']           ?? '',
      semana:           createdIds['Semana']                ?? '',
      dia:              createdIds['Día sugerido']          ?? '',
      direccion:        createdIds['Dirección de contenido'] ?? '',
      copy_ig:          createdIds['Copy IG']               ?? '',
      copy_fb:          createdIds['Copy FB']               ?? '',
      copy_li:          createdIds['Copy LI']               ?? '',
      copy_gmb:         createdIds['Copy GMB']              ?? '',
      fecha_programada: createdIds['Fecha programada']      ?? '',
      hora:             createdIds['Hora']                  ?? '',
      url_design:       createdIds['URL Diseño']            ?? '',
      status_design:    createdIds['Status Diseño']         ?? '',
      copy_aprobado:    createdIds['Copy Aprobado']         ?? '',
      status_schedule:  createdIds['Status Programación']   ?? '',
    },
  }
}

// ─── ITEM MANAGEMENT ─────────────────────────────────────────────────────────

export async function getBoardItems(boardId: string) {
  const data = await mondayQuery(`
    query {
      boards(ids: [${boardId}]) {
        items_page(limit: 200) {
          items {
            id name
            column_values { id text value column { title } }
          }
        }
      }
    }
  `)
  return data.boards[0]?.items_page?.items || []
}

// Build column_values JSON for create_item / change_multiple_column_values
function buildColValues(
  columns: BoardColumns,
  post: {
    format?: string
    project?: string
    platforms?: string[]
    week?: number
    suggestedDay?: string
    contentDirection?: string
  },
  copy?: { ig?: string; fb?: string; li?: string; gmb?: string },
  schedule?: { date?: string; time?: string; status?: string },
) {
  const v: Record<string, any> = {}

  if (columns.formato    && post.format)            v[columns.formato]    = post.format
  if (columns.proyecto   && post.project)           v[columns.proyecto]   = post.project
  if (columns.plataformas && post.platforms?.length) v[columns.plataformas] = (post.platforms ?? []).join(', ')
  if (columns.semana     && post.week != null)      v[columns.semana]     = String(post.week)
  if (columns.dia        && post.suggestedDay)      v[columns.dia]        = post.suggestedDay
  if (columns.direccion  && post.contentDirection)  v[columns.direccion]  = { text: post.contentDirection }

  if (copy) {
    if (columns.copy_ig  && copy.ig)  v[columns.copy_ig]  = { text: copy.ig }
    if (columns.copy_fb  && copy.fb)  v[columns.copy_fb]  = { text: copy.fb }
    if (columns.copy_li  && copy.li)  v[columns.copy_li]  = { text: copy.li }
    if (columns.copy_gmb && copy.gmb) v[columns.copy_gmb] = { text: copy.gmb }
  }

  if (schedule) {
    if (columns.fecha_programada && schedule.date) v[columns.fecha_programada] = { date: schedule.date }
    if (columns.hora             && schedule.time) v[columns.hora]             = schedule.time
    if (schedule.status) v['status'] = { label: schedule.status }
  }

  return v
}

// Create a calendar item with all post data in structured columns
export async function createCalendarItem(
  boardId: string,
  columns: BoardColumns,
  post: {
    name?: string
    format?: string
    project?: string
    platforms?: string[]
    week?: number
    suggestedDay?: string
    contentDirection?: string
  },
  copy?: { ig?: string; fb?: string; li?: string; gmb?: string },
) {
  const colVals = buildColValues(columns, post, copy)
  const data = await mondayQuery(`
    mutation($boardId: ID!, $name: String!, $colVals: JSON!) {
      create_item(board_id: $boardId, item_name: $name, column_values: $colVals) {
        id name
      }
    }
  `, {
    boardId,
    name: post.name ?? 'Post sin nombre',
    colVals: JSON.stringify(colVals),
  })
  return data.create_item as { id: string; name: string }
}

// Update an existing item's copy and/or schedule columns
export async function updateCalendarItem(
  boardId: string,
  itemId: string,
  columns: BoardColumns,
  copy?: { ig?: string; fb?: string; li?: string; gmb?: string },
  schedule?: { date?: string; time?: string; status?: string },
) {
  const colVals = buildColValues(columns, {}, copy, schedule)
  if (Object.keys(colVals).length === 0) return null
  const data = await mondayQuery(`
    mutation($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) {
        id
      }
    }
  `, { boardId, itemId, colVals: JSON.stringify(colVals) })
  return data.change_multiple_column_values
}

// Legacy: create item without structured columns (kept for compatibility)
export async function createItem(boardId: string, itemName: string, columnValues: Record<string, string>) {
  const data = await mondayQuery(`
    mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id name
      }
    }
  `, { boardId, itemName, columnValues: JSON.stringify(columnValues) })
  return data.create_item
}

export async function updateItem(boardId: string, itemId: string, columnId: string, value: string) {
  const data = await mondayQuery(`
    mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
      change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
        id
      }
    }
  `, { boardId, itemId, columnId, value: JSON.stringify(value) })
  return data.change_column_value
}

export async function createUpdate(itemId: string, body: string) {
  const data = await mondayQuery(`
    mutation($itemId: ID!, $body: String!) {
      create_update(item_id: $itemId, body: $body) {
        id
      }
    }
  `, { itemId, body })
  return data.create_update
}

// ─── DOCS ─────────────────────────────────────────────────────────────────────

export async function createDoc(title: string, content: string) {
  try {
    const wsId = await getDefaultWorkspaceId()
    if (!wsId) throw new Error('Workspace no encontrado')
    const data = await mondayQuery(`
      mutation($workspaceId: ID!, $title: String!) {
        create_board(board_name: $title, board_kind: public, workspace_id: $workspaceId) {
          id
        }
      }
    `, { workspaceId: wsId, title })
    const boardId = data.create_board.id
    await mondayQuery(`
      mutation($boardId: ID!, $itemName: String!) {
        create_item(board_id: $boardId, item_name: $itemName) { id }
      }
    `, { boardId, itemName: content.slice(0, 255) || 'Briefing guardado' })
    return { id: boardId, url: `https://monday.com/boards/${boardId}` }
  } catch (err) {
    console.error('[Monday] Error guardando Briefing:', err)
    return { id: 'backup-doc-id', url: '' }
  }
}

export async function findDoc(titlePattern: string) {
  try {
    const data = await mondayQuery(`query { docs(limit: 50) { id name url } }`)
    return data.docs?.find((d: { name: string }) =>
      d.name.toLowerCase().includes(titlePattern.toLowerCase())
    ) || null
  } catch {
    return null
  }
}

export async function getDocContent(docId: string) {
  try {
    const data = await mondayQuery(`
      query {
        docs(ids: [${docId}]) {
          id name url
          blocks { id type content }
        }
      }
    `)
    const doc = data.docs?.[0]
    if (!doc) return null
    const text = doc.blocks?.map((b: { content: string }) => b.content).join('\n') || ''
    return { ...doc, text }
  } catch {
    return null
  }
}

// ─── ACTUALIZACIONES DE ITEMS ────────────────────────────────────────────────

// Actualizar URL de diseño y status
export async function updateItemDesign(
  boardId: string,
  itemId: string,
  columns: BoardColumns,
  designUrl: string,
  status: 'aprobado' | 'rechazado' | 'en revisión' = 'aprobado'
) {
  const colVals: Record<string, any> = {}
  if (columns.url_design)    colVals[columns.url_design]    = designUrl
  if (columns.status_design) colVals[columns.status_design] = { label: status }
  
  if (Object.keys(colVals).length === 0) return null
  
  const data = await mondayQuery(`
    mutation($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) {
        id
      }
    }
  `, { boardId, itemId, colVals: JSON.stringify(colVals) })
  return data.change_multiple_column_values
}

// Actualizar copy aprobado
export async function updateItemCopy(
  boardId: string,
  itemId: string,
  columns: BoardColumns,
  copyData: { ig?: string; fb?: string; li?: string; gmb?: string }
) {
  const colVals: Record<string, any> = {}
  if (columns.copy_ig  && copyData.ig)  colVals[columns.copy_ig]  = { text: copyData.ig }
  if (columns.copy_fb  && copyData.fb)  colVals[columns.copy_fb]  = { text: copyData.fb }
  if (columns.copy_li  && copyData.li)  colVals[columns.copy_li]  = { text: copyData.li }
  if (columns.copy_gmb && copyData.gmb) colVals[columns.copy_gmb] = { text: copyData.gmb }
  if (columns.copy_aprobado) colVals[columns.copy_aprobado] = { text: 'Aprobado' }
  
  if (Object.keys(colVals).length === 0) return null
  
  const data = await mondayQuery(`
    mutation($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) {
        id
      }
    }
  `, { boardId, itemId, colVals: JSON.stringify(colVals) })
  return data.change_multiple_column_values
}

// Actualizar status de programación
export async function updateItemScheduleStatus(
  boardId: string,
  itemId: string,
  columns: BoardColumns,
  status: 'programado' | 'publicado' | 'error' = 'programado'
) {
  const colVals: Record<string, any> = {}
  if (columns.status_schedule) colVals[columns.status_schedule] = { label: status }
  
  if (Object.keys(colVals).length === 0) return null
  
  const data = await mondayQuery(`
    mutation($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) {
        id
      }
    }
  `, { boardId, itemId, colVals: JSON.stringify(colVals) })
  return data.change_multiple_column_values
}
