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
