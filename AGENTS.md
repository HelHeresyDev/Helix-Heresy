# Repository Agent Instructions

## Testing Policy

- Run only focused tests that directly cover the files, features, or behavior changed in the current task.
- Do not run the complete test suite, all Playwright tests, or other broad regression suites automatically, including before commits or pushes.
- When a change affects shared infrastructure, select the smallest named group of relevant test files or test cases needed to validate it.
- A full-suite run is allowed only when the user explicitly requests it in the current chat.
- In the final response, state which focused tests were run and note that the full suite was not run under this policy.
