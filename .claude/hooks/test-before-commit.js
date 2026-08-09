const { execSync } = require("child_process");

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
  if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0);

  try {
    execSync("npm test", { stdio: "pipe" });
  } catch (e) {
    const output = `${e.stdout || ""}${e.stderr || ""}`;
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Tests failed — commit blocked until they pass.\n\n${output}`,
        },
      }),
    );
  }
});
