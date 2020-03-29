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
        if (!err) {
            addNewEdgeInGraph(phone, longitude, latitude, 5)
            return res.send(JSON.stringify({'success': true, 'message': 'updated location'}))
        } else {
            return res.send(JSON.stringify({'success': false, 'err': err}))
        }
    });
}

function addNewEdgeInGraph(phone, longitude, latitude, distanceInMeter) {
    redisConn.georadius(config.peoplesLocKey, longitude, latitude, distanceInMeter, 'm', function(err, list) {
        if(!err && list) {
            selfIndex = list.indexOf(phone)
            if (selfIndex != -1) {
                list.splice(selfIndex, 1)
            }
            edgesList = []
            list.forEach(element => {
                edgesList.push([phone, element])
            });
            console.log(edgesList) //todo: do something here with list of edges
        }
    })
}

