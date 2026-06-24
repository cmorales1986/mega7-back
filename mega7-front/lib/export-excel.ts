import * as XLSX from "xlsx";

/**
 * Descarga data como archivo .xlsx.
 * @param data   Array de objetos planos (las keys se usan como encabezados)
 * @param filename  Nombre del archivo sin extensión
 * @param sheetName  Nombre de la hoja (max 31 chars)
 */
export function exportToExcel(
  data: object[],
  filename: string,
  sheetName?: string
) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (sheetName ?? filename).slice(0, 31));
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${date}.xlsx`);
}
