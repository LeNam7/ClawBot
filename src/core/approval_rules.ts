const DANGEROUS_PATTERNS = [
  /rm\s+-rf?/i,
  /del\s+\/[sqf]/i,        // Windows del /s /q /f
  /rmdir\s+\/s/i,          // Windows rmdir /s
  /format\s+[a-z]:/i,
  /mkfs/i,
  /dd\s+if=/i,
  /shutdown|reboot|halt/i,
  />\s*\/dev\/(sd|hd|nvme)/i,
  /curl.*\|\s*(bash|sh|zsh)/i,
  /wget.*\|\s*(bash|sh|zsh)/i,
  /:\(\)\s*\{/,             // fork bomb
  /chmod\s+[0-7]*7[0-7]*\s+\//i,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command));
}

export function shouldRequireApproval(
  command: string,
  approvalMode: "always" | "smart" | "never"
): boolean {
  if (approvalMode === "always") return true;
  if (approvalMode === "smart") return isDangerous(command);
  return false;
}
