/**
 * Feature separation: JSON export logic
 */
export function exportToJSON(data) {
  const jsonStr = JSON.stringify(data, null, 2);
  console.log('Exported JSON:', jsonStr);
}
