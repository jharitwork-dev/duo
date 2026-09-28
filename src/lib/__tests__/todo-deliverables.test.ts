import { describe, expect, it } from 'vitest';
import { parseDeliverables } from '../todo-deliverables';

describe('parseDeliverables', () => {
  it('returns empty result for null or empty notes', () => {
    expect(parseDeliverables(null)).toEqual({ items: [], rest: '' });
    expect(parseDeliverables('')).toEqual({ items: [], rest: '' });
  });

  it('extracts -, • and ✓ bullet lines as items', () => {
    expect(parseDeliverables('- สรุปผลการสัมภาษณ์\n• ข้อมูลปัญหาที่พบ\n✓ หลักฐานประกอบ')).toEqual({
      items: ['สรุปผลการสัมภาษณ์', 'ข้อมูลปัญหาที่พบ', 'หลักฐานประกอบ'],
      rest: '',
    });
  });

  it('keeps non-item lines in rest and collapses blank lines', () => {
    expect(parseDeliverables('นำข้อมูลไปวิเคราะห์\n- ไฟล์ A\n\n- ไฟล์ B')).toEqual({
      items: ['ไฟล์ A', 'ไฟล์ B'],
      rest: 'นำข้อมูลไปวิเคราะห์',
    });
    expect(parseDeliverables('บรรทัด 1\n\n\n\nบรรทัด 2\n- x')).toEqual({
      items: ['x'],
      rest: 'บรรทัด 1\n\nบรรทัด 2',
    });
  });

  it('allows leading whitespace before the marker', () => {
    expect(parseDeliverables('  - x')).toEqual({ items: ['x'], rest: '' });
  });

  it('handles CRLF line endings', () => {
    expect(parseDeliverables('intro\r\n- a\r\n- b\r\n')).toEqual({ items: ['a', 'b'], rest: 'intro' });
  });

  it('drops markers with empty text', () => {
    expect(parseDeliverables('- \n- a')).toEqual({ items: ['a'], rest: '' });
  });

  it('keeps a dash without a following space in rest', () => {
    expect(parseDeliverables('-5 องศา')).toEqual({ items: [], rest: '-5 องศา' });
  });
});
