// Dev-server only. A browser tab / websocket reset (ECONNRESET, EPIPE) surfaces as an
// unhandled 'error' event and kills `react-scripts start`. Swallow just those; rethrow the rest.
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'ECONNRESET' || err.code === 'EPIPE')) return;
  console.error(err);
  process.exit(1);
});
