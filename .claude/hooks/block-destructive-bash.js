let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(data);
  } catch {
    process.exit(0);
  }

  const cmd = input.tool_input?.command || "";

  const rules = [
    { pattern: /\brm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*)\b/, reason: "recursive force-delete (rm -rf)" },
    { pattern: /\bgit\s+push\b(?=.*(--force\b|--force-with-lease\b|-f\b))/, reason: "force-push (rewrites remote history)" },
    { pattern: /\bgit\s+reset\s+--hard\b/, reason: "git reset --hard (discards uncommitted work)" },
    { pattern: /\bgit\s+clean\b(?=.*-\w*f\w*)/, reason: "git clean -f (deletes untracked files)" },
    { pattern: /\bgit\s+branch\s+-D\b/, reason: "git branch -D (force branch delete)" },
    { pattern: /\bgit\s+(checkout|restore)\b(?=.*(--|\s)\.)/, reason: "discards uncommitted changes (checkout/restore .)" },
    { pattern: /--no-verify\b/, reason: "--no-verify (skips hooks)" },
  ];

  const hit = rules.find((r) => r.pattern.test(cmd));
  if (hit) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: `Destructive command detected: ${hit.reason}. Confirm before proceeding.`,
        },
      }),
    );
  }
});
