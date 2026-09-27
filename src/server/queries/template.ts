import { db } from '@/db';
import { phaseTemplates } from '@/db/schema/phaseTemplates';
import { eq, or, desc, asc } from 'drizzle-orm';

/**
 * Returns all built-in templates PLUS templates created by this user.
 * Ordered by isBuiltIn DESC (built-in first), then name ASC.
 */
export async function getTemplates(userId: string) {
  const result = await db.query.phaseTemplates.findMany({
    where: or(
      eq(phaseTemplates.isBuiltIn, true),
      eq(phaseTemplates.createdBy, userId),
    ),
    orderBy: [desc(phaseTemplates.isBuiltIn), asc(phaseTemplates.name)],
  });

  return result;
}

/**
 * Returns a single template with its parsed structure.
 */
export async function getTemplateById(templateId: string) {
  const template = await db.query.phaseTemplates.findFirst({
    where: eq(phaseTemplates.id, templateId),
  });

  if (!template) return null;

  return {
    ...template,
    parsedStructure: JSON.parse(template.structure) as {
      phases: {
        name: string;
        description?: string;
        todos: {
          title: string;
          submissionMode?: 'group' | 'individual';
        }[];
      }[];
    },
  };
}
