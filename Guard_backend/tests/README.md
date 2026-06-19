# GuardHub Backend API & Database Testing Suite

This directory contains scripts to verify the functionality of GuardHub's backend services, database connectivity, and API endpoints.

## Directory Structure

- **[db.test.js](file:///e:/GuardHub/Guard_backend/tests/db.test.js)**: Verifies connection to the MongoDB Atlas cluster and verifies that database collections exist and are accessible.
- **[attendance.test.js](file:///e:/GuardHub/Guard_backend/tests/attendance.test.js)**: Tests the attendance-related endpoints, including querying existing and non-existent employee attendance records.
- **[run.js](file:///e:/GuardHub/Guard_backend/tests/run.js)**: A test runner script that executes all tests, reports failures/successes, and handles environment setups.

## Prerequisites

Make sure the backend environment configuration (`.env` file) exists in the `Guard_backend` root directory and contains a valid `MONGO_URI`.

## Running the Tests

To run the complete test suite, execute the following command from the `Guard_backend` directory:

```bash
npm test
```

Or run the runner script directly:

```bash
node tests/run.js
```

To run individual tests using Node.js's native test runner:

```bash
node --test tests/db.test.js
node --test tests/attendance.test.js
```
