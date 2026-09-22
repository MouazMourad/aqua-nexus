import { addLocalCalendarDays,localDateKey } from "@/domain/timeSafety";
export const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
export const nowISO = () => new Date().toISOString();
export const today = () => localDateKey();

export function daysFrom(date: string | undefined, days: number) {
  return addLocalCalendarDays(date || today(),days);
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
