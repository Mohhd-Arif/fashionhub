const express = require('express');
const fs = require('fs');
const path = require('path');
const { connectDatabase, getDatabase, closeDatabase, connectionErrorMessage } = require('./config/database');
const helmet = require('helmet');
const { protectWrites } = require('./service/auth');
const { ensureIndexes } = require('./config/indexes');
const { retryImageCleanup } = require('./service/images');
const server = express();
const frontendDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.resolve(__dirname, '../FHUB_ui/dist');
const frontendIndex = path.join(frontendDist, 'index.html');

server.disable('x-powered-by');
server.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
server.use(express.json({ limit: '100kb' }));
server.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, protectWrites);
server.use('/api/auth', require('./route/auth'));
server.use('/api/admin/articles', require('./route/articles'));
server.use('/api/admin/storefront', require('./route/storefront'));
server.use('/api', require('./route/catalogue'));
server.use('/api/images', require('./route/images'));
server.use("/test",(req,res)=>{return res.json({status:"working with test"})});

server.get('/health', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await getDatabase().command({ ping: 1 }, { timeoutMS: 3000 });
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

if (fs.existsSync(frontendIndex)) {
  console.log(`Serving frontend build from ${frontendDist}`);
  server.use(express.static(frontendDist, {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
    }
  }));
  server.get(/^\/(?!api(?:\/|$)|health$|test$).*/, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(frontendIndex);
  });
} else {
  console.warn(`Frontend build not found at ${frontendIndex}. Build FHUB_ui before starting the server.`);
}

let listener;
let shuttingDown = false;
let cleanupTimer;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(cleanupTimer);
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  if (listener) await new Promise(resolve => listener.close(resolve));
  await closeDatabase();
  clearTimeout(timeout);
}

async function start() {
  const port = Number(process.env.PORT || 8000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be an integer between 1 and 65535.');
    process.exitCode = 1;
    return;
  }
  try {
    await connectDatabase();
    await ensureIndexes(getDatabase());
    const cleanup = () => retryImageCleanup().catch(() => console.error('Image cleanup will retry later.'));
    await cleanup();
    cleanupTimer = setInterval(cleanup, 60000);
    cleanupTimer.unref();
    console.log('MongoDB connected successfully.');
    listener = server.listen(port, () => console.log(`Server listening on port ${port}`));
    listener.on('error', async error => {
      console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : 'HTTP server failed to start.');
      await closeDatabase();
      clearInterval(cleanupTimer);
      process.exitCode = 1;
    });
  } catch (error) {
    await closeDatabase();
    console.error(connectionErrorMessage(error));
    process.exitCode = 1;
  }
}

server.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
server.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000) return res.status(409).json({ error: error.keyPattern?.email ? 'This email is already registered.' : 'An article with this name already exists.' });
  if (error.name === 'MulterError') return res.status(400).json({ error: 'Upload up to 6 images, each under 5 MB, using the images field.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
  console.error('API request failed:', error.name || 'Error');
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

if (require.main === module) {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  start();
}

module.exports = server;
