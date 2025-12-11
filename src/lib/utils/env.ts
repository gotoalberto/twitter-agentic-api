export function cleanEnvVar(value: string | undefined): string {
  if (!value) return '';
  // Remove leading/trailing quotes (both single and double)
  // Trim all whitespace including newlines, tabs, etc.
  return value.replace(/^["']|["']$/g, '').trim();
}
