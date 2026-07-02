import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { setApiKey } from '../../lib/storage'

// Shown when analysis fails for lack of a (valid) API key. Saves to
// chrome.storage.local — the background worker reads it on the next capture.
export default function ApiKeyForm() {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  function onSubmit(event: React.FormEvent): void {
    event.preventDefault()
    if (!value.trim()) return
    void setApiKey(value).then(() => {
      setValue('')
      setSaved(true)
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="m-3 flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
    >
      <label htmlFor="claude-api-key" className="flex items-center gap-2 text-xs font-medium text-primary">
        <KeyRound className="h-4 w-4 text-accent" />
        Claude API key
      </label>
      <input
        id="claude-api-key"
        type="password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="sk-ant-…"
        autoComplete="off"
        className="rounded-md border border-line bg-raised px-2.5 py-1.5 font-mono text-xs text-primary placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted">Stored locally, only sent to api.anthropic.com.</p>
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {saved && (
        <p className="text-xs text-success">Key saved — inspect an element to analyze again.</p>
      )}
    </form>
  )
}
