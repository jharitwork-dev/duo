import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateShort,
  formatDateTime,
  formatSubmissionDate,
  formatFileSize,
  fileTypeTag,
} from '../format';
import { validateFile, submissionKey, validateSubmissionFile } from '../r2';

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

describe('Submission display helpers', () => {
  it('formatSubmissionDate renders Bangkok day + short Thai month + HH.mm', () => {
    expect(formatSubmissionDate(new Date('2026-09-18T06:59:00Z'))).toBe('18 ก.ย. 13.59');
  });

  it('formatSubmissionDate zero-pads and rolls over into the next Bangkok day', () => {
    expect(formatSubmissionDate(new Date('2026-01-05T17:05:00Z'))).toBe('6 ม.ค. 00.05');
  });

  it('formatFileSize uses B / KB / MB with one decimal', () => {
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe('2.4 MB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('fileTypeTag returns the uppercase extension or FILE', () => {
    expect(fileTypeTag('market-v1.pdf')).toBe('PDF');
    expect(fileTypeTag('a.DOCX')).toBe('DOCX');
    expect(fileTypeTag('noext')).toBe('FILE');
  });
});

describe('Submission file validation', () => {
  it('accepts PDF and DOC under 10 MB', () => {
    expect(validateSubmissionFile('application/pdf', 1000)).toBe(true);
    expect(validateSubmissionFile('application/msword', 1000)).toBe(true);
  });

  it('rejects files over 10 MB', () => {
    expect(validateSubmissionFile('application/pdf', 11 * 1024 * 1024)).toBe(false);
  });

  it('rejects disallowed content types', () => {
    expect(validateSubmissionFile('text/html', 10)).toBe(false);
  });

  it('validateFile now allows application/msword', () => {
    expect(validateFile('application/msword', 1000)).toBe(true);
  });
});
