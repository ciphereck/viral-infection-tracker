config = require('config');
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {res.send('Viral Infection Server Running!');});

app.listen(port, () => console.log(`App listening on port ${port}!`));