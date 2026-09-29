// Bun loads .env automatically. Tests must never inherit provider credentials.
for (const key of Object.keys(process.env)) {
  if (/TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|PUSHOVER/.test(key)) {
    delete process.env[key];
  }
}
process.env["NODE_ENV"] = "test";
process.env["DO_NOT_TRACK"] = "1";
