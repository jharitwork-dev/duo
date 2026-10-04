import { describe, it, expect } from 'vitest';
import { parseTemplateStructure } from '../template-structure';

describe('parseTemplateStructure', () => {
  it('parses an old-style template (title + submissionMode only)', () => {
    const json = JSON.stringify({
      phases: [{ name: 'P', description: 'd', todos: [{ title: 'T', submissionMode: 'individual' }] }],
    });
    expect(parseTemplateStructure(json)).toEqual({
      phases: [
        {
          name: 'P',
          description: 'd',
          todos: [{ title: 'T', submissionMode: 'individual', description: undefined, notes: undefined }],
        },
      ],
    });
  });

  it('carries description and notes, ignores unknown fields, defaults missing todos to []', () => {
    const json = JSON.stringify({
      extra: true,
      phases: [
        { name: 'A', todos: [{ title: 'T', description: 'x', notes: 'n', foo: 1 }] },
        { name: 'B' },
      ],
    });
    const parsed = parseTemplateStructure(json);
    expect(parsed.phases[0].todos[0]).toEqual({
      title: 'T',
      submissionMode: undefined,
      description: 'x',
      notes: 'n',
    });
    expect(parsed.phases[1].todos).toEqual([]);
  });

  it('returns no phases for malformed JSON', () => {
    expect(parseTemplateStructure('not json')).toEqual({ phases: [] });
    expect(parseTemplateStructure('{}')).toEqual({ phases: [] });
  });

  it('keeps a valid fileRequirement and drops an unknown one (261004-01i)', () => {
    const json = JSON.stringify({
      phases: [
        {
          name: 'P',
          todos: [
            { title: 'A', fileRequirement: 'required' },
            { title: 'B', fileRequirement: 'none' },
            { title: 'C', fileRequirement: 'bogus' },
          ],
        },
      ],
    });
    const todos = parseTemplateStructure(json).phases[0].todos;
    expect(todos[0].fileRequirement).toBe('required');
    expect(todos[1].fileRequirement).toBe('none');
    expect(todos[2].fileRequirement).toBeUndefined();
  });

  it('parses old templates without fileRequirement', () => {
    const json = JSON.stringify({ phases: [{ name: 'P', todos: [{ title: 'T', submissionMode: 'group' }] }] });
    const todo = parseTemplateStructure(json).phases[0].todos[0];
    expect(todo.title).toBe('T');
    expect(todo.fileRequirement).toBeUndefined();
  });
});
