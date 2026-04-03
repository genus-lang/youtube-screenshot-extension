/**
 * Format timestamps into readable H:M:S
 */
export function formatTime(seconds) {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 8);
}
