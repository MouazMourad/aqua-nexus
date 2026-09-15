export const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
export const nowISO = () => new Date().toISOString();
export const today = () => nowISO().slice(0,10);

export function daysFrom(date: string | undefined, days: number) {
  const d = new Date(date || Date.now());
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

export function downloadText(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
