// Template JSON structure (phase_templates.structure). Pure — shared by actions, queries and seed.
import { FILE_REQUIREMENTS, type FileRequirement } from '@/lib/work-page';

export type TemplateSubmissionMode = 'group' | 'individual';

export interface TemplateTodo {
  title: string;
  submissionMode?: TemplateSubmissionMode;
  /** Optional (261004-01i); applyTemplate falls back to 'optional'. */
  fileRequirement?: FileRequirement;
  description?: string;
  notes?: string;
}

export interface TemplatePhase {
  name: string;
  description?: string;
  todos: TemplateTodo[];
}

export interface TemplateStructure {
  phases: TemplatePhase[];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Parses a stored template. Tolerant on purpose so older templates keep working:
 * missing `todos` -> [], unknown fields are ignored, malformed entries are skipped.
 */
export function parseTemplateStructure(json: string): TemplateStructure {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { phases: [] };
  }
  const rawPhases = (raw as { phases?: unknown })?.phases;
  if (!Array.isArray(rawPhases)) return { phases: [] };

  const phases: TemplatePhase[] = [];
  for (const p of rawPhases) {
    if (!p || typeof p !== 'object') continue;
    const name = optionalString((p as { name?: unknown }).name);
    if (!name) continue;
    const rawTodos = (p as { todos?: unknown }).todos;
    const todos: TemplateTodo[] = [];
    if (Array.isArray(rawTodos)) {
      for (const t of rawTodos) {
        if (!t || typeof t !== 'object') continue;
        const title = optionalString((t as { title?: unknown }).title);
        if (!title) continue;
        const mode = (t as { submissionMode?: unknown }).submissionMode;
        const requirement = (t as { fileRequirement?: unknown }).fileRequirement;
        todos.push({
          title,
          submissionMode: mode === 'individual' || mode === 'group' ? mode : undefined,
          fileRequirement: (FILE_REQUIREMENTS as readonly unknown[]).includes(requirement)
            ? (requirement as FileRequirement)
            : undefined,
          description: optionalString((t as { description?: unknown }).description),
          notes: optionalString((t as { notes?: unknown }).notes),
        });
      }
    }
    phases.push({
      name,
      description: optionalString((p as { description?: unknown }).description),
      todos,
    });
  }
  return { phases };
}
