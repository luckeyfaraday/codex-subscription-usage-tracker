import { writeFileSync } from "node:fs";

const outputPath = process.argv[2];
if (!outputPath) process.exit(1);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  writeFileSync(outputPath, input);
  process.stdout.write("tracker\n");
});
