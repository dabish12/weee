const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cfg = require('./src/config');
const { pool } = require('./src/db');
const { loadSession } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');
const routes = require('./routes');

const app = express();
if (cfg.isProd) app.set('trust proxy', 1); // behind the host's HTTPS proxy
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: cfg.isProd ? [] : null, defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'], styleSrc: ["'self'"], scriptSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', loadSession, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, routes);
app.use('/api', notFound);
app.use(express.static(cfg.frontendDir));
app.use(errorHandler);

if (require.main === module) {
  // remove expired sessions hourly
  setInterval(() => pool.execute('DELETE FROM sessions WHERE expires_at < NOW()').catch(() => {}), 3600 * 1000).unref();
  app.listen(cfg.port, () => console.log(`DDEO-SRATMS listening on :${cfg.port}`));
}
module.exports = app;
