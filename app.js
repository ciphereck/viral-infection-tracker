config = require('./config/live');
const express = require('express');
const app = express();
const port = 3000;
const services = require('./services/updateLocation');

app.get('/', (req, res) => {res.send('Viral Infection Server Running!');});

app.put('/heartbeat_location/:phone', services.updateLocationInRedis);

app.get('/is_safe/:phone', services.checkSafetyForUser);

app.listen(port, () => console.log(`App listening on port ${port}! with environment : ${config.configTest}`));