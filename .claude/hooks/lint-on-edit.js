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

  const file = input.tool_input?.file_path || input.tool_response?.filePath;
  if (!file || !/\.tsx?$/.test(file)) process.exit(0);

  let output = "";
  let failed = false;

  try {
    execSync(`npx eslint "${file}"`, { stdio: "pipe" });
  } catch (e) {
    failed = true;
    output += `eslint:\n${e.stdout}${e.stderr}\n`;
  }

  try {
    execSync("npx tsc --noEmit", { stdio: "pipe" });
  } catch (e) {
    failed = true;
    output += `tsc --noEmit:\n${e.stdout}${e.stderr}\n`;
  }

  if (failed) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: output,
        },
      }),
    );
  }
});
