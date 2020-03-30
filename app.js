config = require('config');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const services = require('./services/updateLocation');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {res.send('Viral Infection Server Running!');});

app.put('/heartbeat_location/:phone', services.updateLocationInRedis);

app.get('/is_safe/:phone', services.checkSafetyForUser);

app.post('/register_infection', services.registerInfection);

app.listen(port, () => console.log(`App listening on port ${port}! with environment : ${config.configTest}`));