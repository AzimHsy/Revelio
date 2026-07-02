// chrome.storage.local access (architecture.md → Storage Model). Only the
// API key and (later) recent results live here. The key never enters page
// context and is never logged (invariant 4).

const API_KEY_STORAGE_KEY = 'claudeApiKey'

export async function getApiKey(): Promise<string | null> {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE_KEY)
  const key = stored[API_KEY_STORAGE_KEY]
  return typeof key === 'string' && key.length > 0 ? key : null
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: key.trim() })
}
