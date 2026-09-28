const thaiDateLong = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' });
const thaiDateShort = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' });
const thaiDateTime = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(date: Date | string): string {
  return thaiDateLong.format(new Date(date));
}

export function formatDateShort(date: Date | string): string {
  return thaiDateShort.format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return thaiDateTime.format(new Date(date));
}

// Submission timestamps: "18 ก.ย. 13.59" — fixed to Asia/Bangkok so SSR and client agree.
const thaiDayMonth = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Bangkok',
});
const bangkokTime = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Bangkok',
});

export function formatSubmissionDate(date: Date | string): string {
  const d = new Date(date);
  const parts = bangkokTime.formatToParts(d);
  const hour = (parts.find((p) => p.type === 'hour')?.value ?? '00').padStart(2, '0');
  const minute = (parts.find((p) => p.type === 'minute')?.value ?? '00').padStart(2, '0');
  // Some ICU versions render midnight as "24" with hour12:false.
  const hh = hour === '24' ? '00' : hour;
  return `${thaiDayMonth.format(d)} ${hh}.${minute}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileTypeTag(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) return 'FILE';
  return fileName.slice(dot + 1).toUpperCase();
}
