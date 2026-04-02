require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();

const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');
const frontendPort = parseInt(process.env.FRONTEND_PORT || process.env.PORT || '3000', 10);
const apiBaseUrl = String(process.env.PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');

function sendPublicFile(res, relativePath) {
    return res.sendFile(path.join(publicDir, relativePath));
}

app.get('/js/runtime-config.js', (_req, res) => {
    res.type('application/javascript');
    res.send(
        `window.__APP_CONFIG__ = Object.assign({}, window.__APP_CONFIG__ || {}, ${JSON.stringify({
            apiBaseUrl,
        })});`
    );
});

app.get('/auth/login', (_req, res) => sendPublicFile(res, path.join('auth', 'login.html')));
app.get('/auth/register', (_req, res) => sendPublicFile(res, path.join('auth', 'register.html')));

app.use(express.static(publicDir));

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: 'Local frontend-only server does not host API routes. Set PUBLIC_API_BASE_URL to your VPS API.',
        });
    }

    if (path.extname(req.path)) {
        return next();
    }

    return sendPublicFile(res, 'index.html');
});

if (require.main === module) {
    app.listen(frontendPort, () => {
        console.log(`Cow-Visioning frontend-only server running at http://localhost:${frontendPort}`);
        console.log(
            apiBaseUrl
                ? `All API/auth/upload/gallery requests will target ${apiBaseUrl}`
                : 'PUBLIC_API_BASE_URL is empty. API requests will stay same-origin.'
        );
    });
}

module.exports = app;
