import { describe, it, expect } from 'vitest';
import * as schema from '@/db/schema';
import { createId } from '@/lib/ids';

describe('Database Schema', () => {
  it('exports all table definitions', () => {
    // Core tables
    expect(schema.classrooms).toBeDefined();
    expect(schema.classroomMembers).toBeDefined();
    expect(schema.groups).toBeDefined();
    expect(schema.groupMembers).toBeDefined();
    expect(schema.phases).toBeDefined();
    expect(schema.todos).toBeDefined();
    expect(schema.todoAttachments).toBeDefined();
    expect(schema.submissions).toBeDefined();
    expect(schema.submissionFiles).toBeDefined();
    expect(schema.comments).toBeDefined();
  });

  it('exports all relation definitions', () => {
    expect(schema.classroomsRelations).toBeDefined();
    expect(schema.classroomMembersRelations).toBeDefined();
    expect(schema.groupsRelations).toBeDefined();
    expect(schema.groupMembersRelations).toBeDefined();
    expect(schema.phasesRelations).toBeDefined();
    expect(schema.todosRelations).toBeDefined();
    expect(schema.todoAttachmentsRelations).toBeDefined();
    expect(schema.submissionsRelations).toBeDefined();
    expect(schema.submissionFilesRelations).toBeDefined();
    expect(schema.commentsRelations).toBeDefined();
  });

  it('createId generates a 24-character string', () => {
    const id = createId();
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(24);
  });

  it('createId generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()));
    expect(ids.size).toBe(100);
  });
});
