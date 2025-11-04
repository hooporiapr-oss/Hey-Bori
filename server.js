const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
app.set('trust proxy', true);

app.get('/', (_req, res) => {
res.type('html').send('<!doctype html><title>Bori Chat — baseline OK</title><h1>OK</h1>');
});

app.get('/debug', (_req, res) => {
res.type('html').send('<!doctype html><title>/debug OK</title><pre>{"ok":true}</pre>');
});

app.listen(PORT, () => console.log(`Bori minimal listening on ${PORT}`));
