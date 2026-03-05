export async function migrateUserPermissions(): Promise<void> {
  const response = await fetch('/api/migrate-permissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    let message = 'Migration request failed'

    try {
      const data = await response.json()
      if (data?.error && typeof data.error === 'string') {
        message = data.error
      }
    } catch {
      // Use default message when response is not JSON.
    }

    throw new Error(message)
  }
}
