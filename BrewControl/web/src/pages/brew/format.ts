// "20.10.2026" from an ISO date, without a time zone shift.
export const formatIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

// "YYYY-MM-DDTHH:mm" in local time, as <input type="datetime-local"> wants it.
export const toLocalInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
