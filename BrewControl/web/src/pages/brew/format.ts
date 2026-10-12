// "20.10.2026" from an ISO date, without a time zone shift.
export const formatIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};
