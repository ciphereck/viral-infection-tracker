const redis = require('redis');
const redisConn = redis.createClient({'host': config.redis.host, 'port': config.redis.port});

module.exports = {
    updateLocationInRedis: updateLocationInRedis
};

function updateLocationInRedis(req, res) {
    if (!redisConn.connected) {
        return res.send(JSON.stringify({'success': false, 'msg': 'Some connection error with DB'}));
    }
    let phone = req.params.phone;
    let reqQuery = req.query;
    let latitude = reqQuery.lat;
    let longitude = reqQuery.lng;
    if(!latitude || !longitude || !phone || latitude > 90 || latitude < -90 || longitude > 180 || longitude < -180) {
        return res.send(JSON.stringify({'success': false, 'msg': 'Some info missing!'}));
    }
    redisConn.geoadd(config.peoplesLocKey, longitude, latitude, phone, function(err, result) {
        if (!err && result) {
            return res.send(JSON.stringify({'success': true}))
        }
    });
    
}


