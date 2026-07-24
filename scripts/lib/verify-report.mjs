/**
 * Shared helpers for OUKEI HUB verify scripts / release runner.
 */
export function createAssertCounter() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function assert(name, ok, detail) {
    if (ok) {
      passed += 1;
      console.log(`  PASS ${name}`);
    } else {
      failed += 1;
      const msg = detail ? `${name} — ${detail}` : name;
      failures.push(msg);
      console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    }
    return !!ok;
  }

  return {
    assert,
    get passed() { return passed; },
    get failed() { return failed; },
    get failures() { return failures.slice(); },
    summary() {
      return { passed, failed, failures: failures.slice() };
    }
  };
}

export function printSuiteHeader(name) {
  console.log(`\n▶ ${name}`);
}

export function exitFromCounter(counter) {
  const { failed } = counter.summary();
  process.exit(failed ? 1 : 0);
}
