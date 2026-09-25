from pathlib import Path

path = Path("src/i18n/index.ts")
text = path.read_text(encoding="utf-8")

needle = 'export function eventTypeText(lang:Language,type:string){'
if needle not in text:
    raise SystemExit("eventTypeText function not found")

marker = 'export function eventTypeText(lang:Language,type:string){\n'
insert = '''export function eventTypeText(lang:Language,type:string){
  const timelineLabels: Record<string, { ar: string; en: string }> = {
    recovery: { ar: "استعادة", en: "Recovery" },
    chemistry: { ar: "كيمياء", en: "Chemistry" },
    warning: { ar: "تنبيه", en: "Warning" },
    setup: { ar: "إعداد", en: "Setup" },
  };
  const timelineLabel = timelineLabels[type];
  if (timelineLabel) return timelineLabel[lang];
'''

if 'const timelineLabels: Record<string, { ar: string; en: string }>' not in text:
    text = text.replace(marker, insert, 1)

path.write_text(text, encoding="utf-8")
