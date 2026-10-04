import { describe, it, expect } from 'vitest';
import * as schema from '@/db/schema';
import { createId } from '@/lib/ids';
import { GROUP_MODES } from '@/lib/group-rules';
import { FILE_REQUIREMENTS } from '@/lib/work-page';

describe('Database Schema', () => {
  it('exports all table definitions', () => {
    // Core tables
    expect(schema.classrooms).toBeDefined();
    expect(schema.classroomMembers).toBeDefined();
    expect(schema.groups).toBeDefined();
    expect(schema.groupMembers).toBeDefined();
    expect(schema.phases).toBeDefined();
    expect(schema.todos).toBeDefined();
    expect(schema.groupPhaseProgress).toBeDefined();
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
    expect(schema.groupPhaseProgressRelations).toBeDefined();
    expect(schema.todoAttachmentsRelations).toBeDefined();
    expect(schema.submissionsRelations).toBeDefined();
    expect(schema.submissionFilesRelations).toBeDefined();
    expect(schema.commentsRelations).toBeDefined();
  });

  it('has the group limit and group mode columns', () => {
    expect(schema.groups.maxMembers.name).toBe('max_members');
    expect(schema.groups.maxMembers.notNull).toBe(false);
    expect(schema.classrooms.groupMode.name).toBe('group_mode');
    expect(schema.classrooms.groupMode.notNull).toBe(true);
    expect(schema.classrooms.groupMode.default).toBe('teacher');
    expect(schema.classrooms.groupMode.enumValues).toEqual([...GROUP_MODES]);
  });

  it('has the work page tables, relations and columns (261004-01i)', () => {
    expect(schema.workPages).toBeDefined();
    expect(schema.workPageFiles).toBeDefined();
    expect(schema.workPagesRelations).toBeDefined();
    expect(schema.workPageFilesRelations).toBeDefined();
    expect(schema.todos.fileRequirement.name).toBe('file_requirement');
    expect(schema.todos.fileRequirement.notNull).toBe(true);
    expect(schema.todos.fileRequirement.default).toBe('optional');
    expect(schema.todos.fileRequirement.enumValues).toEqual([...FILE_REQUIREMENTS]);
    expect(schema.submissions.content.name).toBe('content');
    expect(schema.submissions.content.notNull).toBe(false);
    expect(schema.workPages.content.notNull).toBe(true);
    expect(schema.workPages.userId.notNull).toBe(false);
    expect(schema.workPages.groupId.notNull).toBe(false);
    expect(schema.workPageFiles.workPageId.notNull).toBe(true);
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
