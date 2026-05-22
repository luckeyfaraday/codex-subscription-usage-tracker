import { writeFileSync } from "node:fs";

const outputPath = process.argv[2];
if (!outputPath) process.exit(1);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    writeFileSync(outputPath, input);
  } catch (err) {
    process.stderr.write(`capture write failed: ${err.message}\n`);
    process.exit(1);
  }
  process.stdout.write("tracker\n");
});
