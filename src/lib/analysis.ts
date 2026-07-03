import type { AnalysisParameter, AnalysisResult, ParameterLabel } from './types'

// Parses Claude's delimiter-sectioned response into an AnalysisResult. Written
// to tolerate PARTIAL input so the panel can render the answer as it streams
// (code-standards.md → parse defensively). Never throws — missing sections
// come back as empty strings / an empty array; the caller validates the final.

const SECTION_RE = /<<<(CONCEPT|EXPLANATION|CODE|PARAMETERS|PREVIEW)>>>/g

export function parseAnalysisText(raw: string): AnalysisResult {
  // Drop a trailing partial marker mid-stream (e.g. "<<<PARA") so it never
  // flashes on screen; a complete ">>>"-closed marker is left intact.
  const text = raw.replace(/<{1,3}[A-Z]*$/, '')

  const sections: Record<string, string> = {}
  const hits: { name: string; markerStart: number; contentStart: number }[] = []
  SECTION_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SECTION_RE.exec(text))) {
    hits.push({ name: match[1], markerStart: match.index, contentStart: SECTION_RE.lastIndex })
  }
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].markerStart : text.length
    sections[hits[i].name] = text.slice(hits[i].contentStart, end).trim()
  }

  return {
    concept: sections['CONCEPT'] ?? '',
    explanation: sections['EXPLANATION'] ?? '',
    gsapCode: stripFences(sections['CODE'] ?? ''),
    parameters: parseParameters(sections['PARAMETERS'] ?? ''),
    previewCode: stripFences(sections['PREVIEW'] ?? ''),
  }
}

/** True once the result has the fields we require to call it complete. */
export function isComplete(result: AnalysisResult): boolean {
  return result.concept !== '' && result.explanation !== '' && result.gsapCode !== ''
}

// Claude is told not to fence the code, but strip fences defensively anyway.
function stripFences(code: string): string {
  const fenced = code.match(/```(?:\w+)?\s*([\s\S]*?)```/)
  return (fenced?.[1] ?? code).trim()
}

const PARAMETER_LABELS = new Set<ParameterLabel>(['SOURCE', 'PARTIAL', 'GUESS'])

// One parameter per line: "name | value | label | description" (enhancement 1).
// The third field is only treated as a label when it is one of the known honesty
// labels — otherwise it's part of the description. That distinguishes the new
// 4-field format from the old 3-field "name | value | description" (old history)
// AND from a still-streaming line whose label hasn't arrived yet. Unlabelled →
// GUESS. Descriptions may contain " | ", so join the remaining fields back.
// Partial trailing lines are skipped until they have at least name + value.
function parseParameters(block: string): AnalysisParameter[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parts = line.split(' | ')
      if (parts.length < 2) return []
      const maybeLabel = (parts[2] ?? '').trim().toUpperCase() as ParameterLabel
      const labelled = PARAMETER_LABELS.has(maybeLabel)
      return [
        {
          name: parts[0],
          value: parts[1],
          label: labelled ? maybeLabel : 'GUESS',
          description: parts.slice(labelled ? 3 : 2).join(' | '),
        },
      ]
    })
}
