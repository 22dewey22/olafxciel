// src/content/classify.js
// Classification alignée sur version_finale.py : fondclasseXX uniquement (+ exclusion TPA)

(function () {
  function extractCellText(cell) {
    if (!cell) return { text: "", title: "" };

    // texte visible de la cellule
    const text = (cell.textContent || "").replace(/\s+/g, " ").trim();

    // souvent l'info utile est dans <a title="...">
    const a = cell.querySelector("a");
    const title = (a?.getAttribute("title") || cell.getAttribute("title") || "").trim();

    return { text, title };
  }

  async function classifyCell(cell) {
    if (!cell) return null;

    const { text, title } = extractCellText(cell);

    // fondclasses uniquement
    const fondclasses = window.ICN_RULES.extractFondclassesFromTd(cell);

    return await window.ICN_RULES.classifyAbsenceByFondclasse(fondclasses, text, title);
  }

  window.ICN_CLASSIFY = { classifyCell, extractCellText };
})();

