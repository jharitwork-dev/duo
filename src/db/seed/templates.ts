/**
 * Seed 4 built-in templates for Innovator's Academy.
 *
 * Run: npx tsx src/db/seed/templates.ts
 *
 * Alternatively, call seedTemplates() on first template query
 * if no built-ins exist (lazy seed fallback).
 */

import { db } from '@/db';
import { phaseTemplates } from '@/db/schema/phaseTemplates';
import { eq } from 'drizzle-orm';
import type { TemplateStructure } from '@/lib/template-structure';

interface BuiltInTemplate {
  name: string;
  description: string;
  structure: TemplateStructure;
}

const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    name: 'Market Research',
    description: 'วิจัยตลาดเบื้องต้น: แบบสอบถาม สัมภาษณ์ และวิเคราะห์ข้อมูล',
    structure: {
      phases: [
        {
          name: 'แบบสอบถาม',
          description: 'ออกแบบและเก็บข้อมูลจากแบบสอบถาม',
          todos: [
            { title: 'ออกแบบแบบสอบถาม' },
            { title: 'ทดสอบแบบสอบถาม' },
            { title: 'เก็บข้อมูล' },
          ],
        },
        {
          name: 'สัมภาษณ์',
          description: 'สัมภาษณ์ลูกค้าเป้าหมายเพื่อรวบรวมข้อมูลเชิงลึก',
          todos: [
            { title: 'เตรียมคำถาม' },
            { title: 'สัมภาษณ์ลูกค้า' },
            { title: 'สรุปข้อมูลเชิงลึก' },
          ],
        },
        {
          name: 'วิเคราะห์',
          description: 'วิเคราะห์และสรุปผลการวิจัย',
          todos: [
            { title: 'วิเคราะห์ข้อมูล' },
            { title: 'สรุปผล' },
            { title: 'นำเสนอ' },
          ],
        },
      ],
    },
  },
  {
    name: 'Product Development',
    description: 'พัฒนาผลิตภัณฑ์: ไอเดีย Prototype และทดสอบ',
    structure: {
      phases: [
        {
          name: 'ไอเดีย',
          description: 'ระบุปัญหาและเลือกแนวทางแก้ไข',
          todos: [
            { title: 'ระบุปัญหา' },
            { title: 'Brainstorm วิธีแก้' },
            { title: 'เลือก Solution' },
          ],
        },
        {
          name: 'Prototype',
          description: 'สร้างและทดสอบ MVP',
          todos: [
            { title: 'สร้าง MVP' },
            { title: 'ทดสอบภายใน' },
          ],
        },
        {
          name: 'ทดสอบ',
          description: 'ทดสอบกับผู้ใช้จริงและปรับปรุง',
          todos: [
            { title: 'ทดสอบกับผู้ใช้' },
            { title: 'เก็บ Feedback' },
            { title: 'ปรับปรุง' },
          ],
        },
      ],
    },
  },
  {
    name: 'Pitch Preparation',
    description: 'เตรียมนำเสนอ: เรื่องราว Pitch Deck และฝึกซ้อม',
    structure: {
      phases: [
        {
          name: 'เรื่องราว',
          description: 'สร้างเรื่องราวและ Value Proposition',
          todos: [
            { title: 'Problem Statement' },
            { title: 'Solution Story' },
            { title: 'Value Proposition' },
          ],
        },
        {
          name: 'Pitch Deck',
          description: 'สร้าง Slide และเตรียมข้อมูลสนับสนุน',
          todos: [
            { title: 'สร้าง Slide' },
            { title: 'เตรียมข้อมูลสนับสนุน' },
            { title: 'ออกแบบ Visual' },
          ],
        },
        {
          name: 'ฝึกซ้อม',
          description: 'ฝึก Pitch และปรับปรุง',
          todos: [
            { title: 'ฝึก Pitch' },
            { title: 'รับ Feedback' },
            { title: 'ปรับปรุงและซ้อมรอบสุดท้าย' },
          ],
        },
      ],
    },
  },
  {
    name: 'Business Model Canvas',
    description: 'วิเคราะห์โมเดลธุรกิจ: Customer Segments, Value Proposition, Business Model',
    structure: {
      phases: [
        {
          name: 'Customer Segments',
          description: 'ระบุและวิเคราะห์กลุ่มลูกค้าเป้าหมาย',
          todos: [
            { title: 'ระบุกลุ่มลูกค้า' },
            { title: 'Customer Persona' },
          ],
        },
        {
          name: 'Value Proposition',
          description: 'กำหนด Pain Points และ Gain Creators',
          todos: [
            { title: 'Pain Points' },
            { title: 'Gain Creators' },
            { title: 'Products & Services' },
          ],
        },
        {
          name: 'Business Model',
          description: 'กำหนดโครงสร้างโมเดลธุรกิจ',
          todos: [
            { title: 'Channels' },
            { title: 'Revenue Streams' },
            { title: 'Key Resources' },
            { title: 'Cost Structure' },
          ],
        },
      ],
    },
  },
  {
    // Already inserted into the live DB by the orchestrator (2026-10-03); kept here so code and DB match.
    name: 'Cocoon Incubation',
    description: 'โปรแกรม Cocoon: Market Research → Go to Market → Scaleup',
    structure: {
      phases: [
        {
          name: 'Market Research',
          todos: [
            { title: 'ทำ Survey', submissionMode: 'group' },
            { title: 'สรุปผล', submissionMode: 'group' },
          ],
        },
        {
          name: 'Go to Market',
          todos: [
            { title: 'เขียนแบบการผลิตให้พร้อม', submissionMode: 'group' },
            { title: 'สั่งผลิตสินค้า', submissionMode: 'group' },
            { title: 'ขายเกิน 70%', submissionMode: 'group' },
          ],
        },
        {
          name: 'Scaleup',
          todos: [{ title: 'จดทะเบียนบริษัท', submissionMode: 'group' }],
        },
      ],
    },
  },
];

/**
 * Upsert the built-in templates. Safe to run multiple times --
 * skips templates that already exist by name.
 */
export async function seedTemplates() {
  for (const template of BUILT_IN_TEMPLATES) {
    // Check if this built-in template already exists
    const existing = await db.query.phaseTemplates.findFirst({
      where: eq(phaseTemplates.name, template.name),
    });

    if (existing) {
      console.log(`Template "${template.name}" already exists, skipping.`);
      continue;
    }

    await db.insert(phaseTemplates).values({
      name: template.name,
      description: template.description,
      isBuiltIn: true,
      createdBy: null,
      structure: JSON.stringify(template.structure),
    });

    console.log(`Seeded template: ${template.name}`);
  }

  console.log('Template seeding complete.');
}

// Run directly: npx tsx src/db/seed/templates.ts
if (require.main === module) {
  seedTemplates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
