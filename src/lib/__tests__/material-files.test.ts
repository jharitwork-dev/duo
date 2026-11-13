import { describe, it, expect } from 'vitest';
import {
  MATERIAL_ERRORS,
  buildMaterialFileKey,
  isMaterialFileKeyInScope,
  normalizeMaterialLinkUrl,
} from '@/lib/material-files';

describe('material files (261113-lz7)', () => {
  it('builds keys under materials/{materialId}/ with a sanitized name', () => {
    expect(buildMaterialFileKey('m1', 'u1', 'my file (1).pdf')).toBe('materials/m1/u1-my_file__1_.pdf');
  });

  it('accepts only flat keys inside the material scope', () => {
    expect(isMaterialFileKeyInScope('materials/m1/u1-a.pdf', 'm1')).toBe(true);
    expect(isMaterialFileKeyInScope('materials/m2/u1-a.pdf', 'm1')).toBe(false);
    expect(isMaterialFileKeyInScope('attachments/m1/a', 'm1')).toBe(false);
    expect(isMaterialFileKeyInScope('materials/m1/', 'm1')).toBe(false);
    expect(isMaterialFileKeyInScope('materials/m1/x/y', 'm1')).toBe(false);
    expect(isMaterialFileKeyInScope('materials/m1/../a', 'm1')).toBe(false);
    expect(isMaterialFileKeyInScope('materials//a', '')).toBe(false);
    expect(isMaterialFileKeyInScope('materials/a/b/c', 'a/b')).toBe(false);
  });
});

describe('normalizeMaterialLinkUrl (261113-lz7)', () => {
  it('treats empty input as no link', () => {
    expect(normalizeMaterialLinkUrl('')).toEqual({ ok: true, url: null });
    expect(normalizeMaterialLinkUrl('   ')).toEqual({ ok: true, url: null });
    expect(normalizeMaterialLinkUrl(undefined)).toEqual({ ok: true, url: null });
    expect(normalizeMaterialLinkUrl(null)).toEqual({ ok: true, url: null });
  });

  it('accepts trimmed http/https URLs', () => {
    expect(normalizeMaterialLinkUrl('  https://x.com/a ')).toEqual({ ok: true, url: 'https://x.com/a' });
    expect(normalizeMaterialLinkUrl('http://x')).toEqual({ ok: true, url: 'http://x' });
  });

  it('rejects other schemes, garbage and overly long URLs', () => {
    expect(normalizeMaterialLinkUrl('javascript:alert(1)')).toEqual({ ok: false });
    expect(normalizeMaterialLinkUrl('ftp://x')).toEqual({ ok: false });
    expect(normalizeMaterialLinkUrl('not a url')).toEqual({ ok: false });
    expect(normalizeMaterialLinkUrl(`https://x.com/${'a'.repeat(2000)}`)).toEqual({ ok: false });
  });

  it('exposes Thai error strings', () => {
    expect(MATERIAL_ERRORS.notFound).toBe('ไม่พบสื่อการเรียน');
    expect(MATERIAL_ERRORS.badLink).toBe('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://');
  });
});
