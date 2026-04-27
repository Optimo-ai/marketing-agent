// Monday.com GraphQL API client

const MONDAY_API_URL = 'https://api.monday.com/v2'

async function mondayQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.MONDAY_API_KEY!,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json()
  if (data.errors) throw new Error(data.errors[0].message)
  return data.data
}

// Get all boards in the Marketing workspace
export async function getMarketingBoards(workspaceId: string = "14748581") {
  const data = await mondayQuery(`
    query {
      boards(workspace_ids: [${workspaceId}], limit: 50) {
        id name description
        columns { id title type }
      }
    }
  `)
  return data.boards
}

// Find a board by name pattern
export async function findBoard(namePattern: string, workspaceId?: string) {
  const boards = await getMarketingBoards(workspaceId)
  return boards.find((b: { name: string }) =>
    b.name.toLowerCase().includes(namePattern.toLowerCase())
  )
}

// Create a new board in the workspace
export async function createBoard(name: string, workspaceId: string = "14748581") {
  const data = await mondayQuery(`
    mutation($workspaceId: ID!, $name: String!) {
      create_board(board_name: $name, board_kind: public, workspace_id: $workspaceId) {
        id
      }
    }
  `, { workspaceId, name })
  return data.create_board
}

// Get items from a board
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

// Create an item in a board
export async function createItem(boardId: string, itemName: string, columnValues: Record<string, string>) {
  const data = await mondayQuery(`
    mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id name
      }
    }
  `, {
    boardId,
    itemName,
    columnValues: JSON.stringify(columnValues),
  })
  return data.create_item
}

// Update item column value
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

// Create a Doc in Monday workspace
export async function createDoc(title: string, content: string) {
  // Create a new item as a doc-style item in the workspace
  const data = await mondayQuery(`
    mutation($workspaceId: ID!, $title: String!) {
      create_doc(location: { workspace: { workspace_id: $workspaceId, name: $title } }) {
        id
        url
      }
    }
  `, { workspaceId: "14748581", title })

  const docId = data.create_doc.id

  // Add content block to the doc
  await mondayQuery(`
    mutation($docId: ID!, $content: JSON!) {
      create_doc_block(type: normal_text, doc_id: $docId, content: $content) {
        id
      }
    }
  `, { 
    docId, 
    content: JSON.stringify({ deltaFormat: [{ insert: content }] }) 
  })

  return data.create_doc
}

// Find a doc by title pattern
export async function findDoc(titlePattern: string) {
  const data = await mondayQuery(`
    query {
      docs(workspace_ids: [14748581], limit: 50) {
        id name url
        doc_folder { id name }
      }
    }
  `)
  return data.docs?.find((d: { name: string }) =>
    d.name.toLowerCase().includes(titlePattern.toLowerCase())
  )
}

// Get doc content
export async function getDocContent(docId: string) {
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
}
