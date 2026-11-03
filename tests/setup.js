// Test setup and environment configuration
require("dotenv").config();

// Override environment variables for testing if needed
process.env.NODE_ENV = "test";

// Mock console.log in tests to reduce noise
if (process.env.NODE_ENV === "test") {
  global.originalConsoleLog = console.log;
  console.log = (...args) => {
    // Only log if it contains 'error' or 'Error'
    if (
      args.some(
        (arg) =>
          typeof arg === "string" &&
          (arg.includes("error") || arg.includes("Error"))
      )
    ) {
      global.originalConsoleLog(...args);
    }
  };
}
