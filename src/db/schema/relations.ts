import { relations } from 'drizzle-orm';
import { classrooms, classroomMembers } from './classrooms';
import { groups, groupMembers } from './groups';
import { phases } from './phases';
import { groupPhaseProgress } from './groupPhaseProgress';
import { todos, todoAttachments } from './todos';
import { classroomTasks, classroomTaskFiles } from './classroomTasks';
import { submissions, submissionFiles } from './submissions';
import { workPages, workPageFiles } from './workPages';
import { comments, commentReads } from './comments';
import { phaseTemplates } from './phaseTemplates';

// Classrooms relations
export const classroomsRelations = relations(classrooms, ({ many }) => ({
  members: many(classroomMembers),
  groups: many(groups),
  phases: many(phases),
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
  todos: many(todos),
  phaseProgress: many(groupPhaseProgress),
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
  classroom: one(classrooms, {
    fields: [phases.classroomId],
    references: [classrooms.id],
  }),
  todos: many(todos),
  progress: many(groupPhaseProgress),
  classroomTasks: many(classroomTasks),
}));

// Classroom-level tasks (261004-j6h)
export const classroomTasksRelations = relations(classroomTasks, ({ one, many }) => ({
  phase: one(phases, {
    fields: [classroomTasks.phaseId],
    references: [phases.id],
  }),
  files: many(classroomTaskFiles),
  copies: many(todos),
}));

export const classroomTaskFilesRelations = relations(classroomTaskFiles, ({ one }) => ({
  classroomTask: one(classroomTasks, {
    fields: [classroomTaskFiles.classroomTaskId],
    references: [classroomTasks.id],
  }),
}));

// Per-group phase progress relations
export const groupPhaseProgressRelations = relations(groupPhaseProgress, ({ one }) => ({
  group: one(groups, {
    fields: [groupPhaseProgress.groupId],
    references: [groups.id],
  }),
  phase: one(phases, {
    fields: [groupPhaseProgress.phaseId],
    references: [phases.id],
  }),
}));

// Todos relations
export const todosRelations = relations(todos, ({ one, many }) => ({
  phase: one(phases, {
    fields: [todos.phaseId],
    references: [phases.id],
  }),
  group: one(groups, {
    fields: [todos.groupId],
    references: [groups.id],
  }),
  classroomTask: one(classroomTasks, {
    fields: [todos.classroomTaskId],
    references: [classroomTasks.id],
  }),
  attachments: many(todoAttachments),
  submissions: many(submissions),
  workPages: many(workPages),
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
  workPage: one(workPages, {
    fields: [comments.workPageId],
    references: [workPages.id],
  }),
}));

export const commentReadsRelations = relations(commentReads, ({ one }) => ({
  workPage: one(workPages, {
    fields: [commentReads.workPageId],
    references: [workPages.id],
  }),
}));

// Work pages relations (261004-01i)
export const workPagesRelations = relations(workPages, ({ one, many }) => ({
  todo: one(todos, {
    fields: [workPages.todoId],
    references: [todos.id],
  }),
  group: one(groups, {
    fields: [workPages.groupId],
    references: [groups.id],
  }),
  files: many(workPageFiles),
  comments: many(comments),
}));

export const workPageFilesRelations = relations(workPageFiles, ({ one }) => ({
  workPage: one(workPages, {
    fields: [workPageFiles.workPageId],
    references: [workPages.id],
  }),
}));
