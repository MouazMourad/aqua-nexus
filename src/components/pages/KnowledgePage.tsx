export function KnowledgePage() {
  const sections = [
    ["الأمراض والعلاج", "تشخيص وعلاج حسب نوع الحوض والكائن"],
    ["الطوارئ", "خطوات واضحة للحالات الحرجة"],
    ["الحجر الصحي", "Quarantine / Hospital Tank"],
    ["التغذية", "Feeding Manager"],
    ["RO/DI", "سجل جودة مياه التحلية"],
    ["الحاسبات", "Dosing / Water Change / Volume"],
    ["المعرفة", "مرجع الأنواع والمعدات والصيانة"]
  ];

  return (
    <section className="page-grid">
      <div className="page-header">
        <div><small>KNOWLEDGE CENTER</small><h2>مركز المعرفة</h2></div>
      </div>
      <div className="knowledge-grid full-span">
        {sections.map(([title, desc]) => (
          <article className="knowledge-card" key={title}>
            <span>◇</span>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
