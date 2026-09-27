import { relations } from 'drizzle-orm';
import { classrooms, classroomMembers } from './classrooms';
import { groups, groupMembers } from './groups';
import { phases } from './phases';
import { todos, todoAttachments } from './todos';
import { submissions, submissionFiles } from './submissions';
import { comments } from './comments';
import { phaseTemplates } from './phaseTemplates';

// Classrooms relations
export const classroomsRelations = relations(classrooms, ({ many }) => ({
  members: many(classroomMembers),
  groups: many(groups),
}));

export const classroomMembersRelations = relations(classroomMembers, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomMembers.classroomId],
    references: [classrooms.id],
  }),
}));

// Groups relations
export const groupsRelations = relations(groups, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [groups.classroomId],
    references: [classrooms.id],
  }),
  members: many(groupMembers),
  phases: many(phases),
  submissions: many(submissions),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
}));

// Phases relations
export const phasesRelations = relations(phases, ({ one, many }) => ({
  group: one(groups, {
    fields: [phases.groupId],
    references: [groups.id],
  }),
  todos: many(todos),
}));

// Todos relations
export const todosRelations = relations(todos, ({ one, many }) => ({
  phase: one(phases, {
    fields: [todos.phaseId],
    references: [phases.id],
  }),
  attachments: many(todoAttachments),
  submissions: many(submissions),
}));

export const todoAttachmentsRelations = relations(todoAttachments, ({ one }) => ({
  todo: one(todos, {
    fields: [todoAttachments.todoId],
    references: [todos.id],
  }),
}));

// Submissions relations
export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  todo: one(todos, {
    fields: [submissions.todoId],
    references: [todos.id],
  }),
  group: one(groups, {
    fields: [submissions.groupId],
    references: [groups.id],
  }),
  files: many(submissionFiles),
  comments: many(comments),
}));

export const submissionFilesRelations = relations(submissionFiles, ({ one }) => ({
  submission: one(submissions, {
    fields: [submissionFiles.submissionId],
    references: [submissions.id],
  }),
}));

// Comments relations
export const commentsRelations = relations(comments, ({ one }) => ({
  submission: one(submissions, {
    fields: [comments.submissionId],
    references: [submissions.id],
  }),
}));
