const SHEET_ID = "1EdQ3Lb7UUuEdEjF9Z5cWMqYW0XU74-ll_rCQWmP1Te8";
const ALLOWED_SHEETS = ["Kunden", "Artikel"];

function parseGoogleVisualizationResponse(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Keine gültige Google-Sheets-Antwort erhalten.");
  }

  const json = JSON.parse(text.slice(start, end + 1));
  const table = json.table;

  if (!table || !table.cols || !table.rows) {
    throw new Error("Google-Sheets-Tabelle konnte nicht gelesen werden.");
  }

  const headers = table.cols.map((col, index) => {
    const label = String(col.label || "").trim();
    return label || `Spalte_${index + 1}`;
  });

  return table.rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      const cell = row.c && row.c[index] ? row.c[index] : null;
      obj[header] = cell && cell.v !== undefined && cell.v !== null ? cell.v : "";
    });
    return obj;
  }).filter(row => Object.values(row).some(value => String(value).trim() !== ""));
}

export default async function handler(req, res) {
  try {
    const sheet = String(req.query.sheet || "").trim();

    if (!ALLOWED_SHEETS.includes(sheet)) {
      return res.status(400).json({
        success: false,
        error: "Ungültiger Tabellenname. Erlaubt sind: Kunden, Artikel."
      });
    }

    const url =
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
      `?tqx=out:json&sheet=${encodeURIComponent(sheet)}&t=${Date.now()}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Eschenbacher-Bestelltool/1.0"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Google Sheets konnte nicht geladen werden.",
        details: text.slice(0, 500)
      });
    }

    const data = parseGoogleVisualizationResponse(text);

    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Fehler beim Laden der Google-Sheets-Daten."
    });
  }
}
