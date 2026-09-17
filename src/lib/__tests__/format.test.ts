import { describe, it, expect } from 'vitest';
import { formatDate, formatDateShort, formatDateTime } from '../format';
import { validateFile, submissionKey } from '../r2';

describe('Thai date formatting', () => {
  it('formatDate outputs Buddhist Era year (2569 for 2026 CE)', () => {
    const result = formatDate(new Date('2026-01-15'));
    expect(result).toContain('2569');
  });

  it('formatDate output contains Thai month name for January', () => {
    const result = formatDate(new Date('2026-01-15'));
    expect(result).toContain('มกราคม');
  });

  it('formatDateShort returns a shorter string than formatDate for the same input', () => {
    const date = new Date('2026-06-20');
    const long = formatDate(date);
    const short = formatDateShort(date);
    expect(short.length).toBeLessThan(long.length);
  });

  it('formatDateTime output contains ":" (time separator present)', () => {
    const result = formatDateTime(new Date('2026-01-15T14:30:00'));
    expect(result).toContain(':');
  });
});

describe('R2 validation and key helpers', () => {
  it('validateFile accepts valid PDF under size limit', () => {
    expect(validateFile('application/pdf', 1000)).toBe(true);
  });

  it('validateFile rejects file over 50MB', () => {
    expect(validateFile('application/pdf', 60 * 1024 * 1024)).toBe(false);
  });

  it('validateFile rejects disallowed content type', () => {
    expect(validateFile('text/html', 1000)).toBe(false);
  });

  it('submissionKey builds correct path', () => {
    expect(submissionKey('user1', 'todo1', 'file.pdf')).toBe(
      'submissions/user1/todo1/file.pdf'
    );
  });
});
