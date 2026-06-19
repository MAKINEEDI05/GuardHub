const { spawn } = require("child_process");
const path = require("path");

console.log("==========================================");
console.log("   GuardHub Backend Testing Suite Runner  ");
console.log("==========================================\n");

// Execute native Node.js tests using the built-in test runner
const testProcess = spawn("node", ["--test", "tests/db.test.js", "tests/attendance.test.js"], {
  stdio: "inherit",
  cwd: path.resolve(__dirname, ".."),
  env: {
    ...process.env,
    NODE_ENV: "test"
  }
});

testProcess.on("exit", (code) => {
  console.log("\n==========================================");
  if (code === 0) {
    console.log("   ✅ All tests completed successfully!  ");
  } else {
    console.log(`   ❌ Test suite failed with exit code: ${code}`);
  }
  console.log("==========================================");
  process.exit(code);
});
