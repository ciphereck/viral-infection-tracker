const redis = require('redis');
const neo4j = require('neo4j-driver');

const redisConn = redis.createClient({'host': config.redis.host, 'port': config.redis.port});
const driver = neo4j.driver(config.neo4j.path);

const neo4jWriteSess = driver.session({defaultAccessMode: neo4j.session.WRITE});

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
            console.log(edgesList); //todo: do something here with list of edges
            if (!edgesList.length) {
                return;
            }
            let queryParams = generateQueryForEdgeInsertion(edgesList);
            neo4jWriteSess.run(queryParams.query, queryParams.varObj)
            .catch(err=> console.log(`err = ${err}\nquery = ${queryParams.query}\nvarParams = ${JSON.stringify(queryParams.varObj)}`));
        }
    })
}

function generateQueryForEdgeInsertion(edges) {
    let neo4jQuery = `CREATE `
    let i = 0;
    let result = {};
    let varObj = {};
    let nodeNames = ['a'];
    for (let edge of edges) {
        if (!Array.isArray(edge) || edge.length != 2) {
            continue;
        }
        i = i + 1;
        if (i > 1) {
            neo4jQuery += ',';
        }
        neo4jQuery += `(a:Person{phone:${('$personA' + i + 'Phn')}})-[:MET{at:$timeStamp}]->(${('b' + i)}:Person{phone:${('$personB' + i + 'Phn')}})`;
        neo4jQuery += `, (${('b' + i)})-[:MET{at: $timeStamp}]->(a)`;
        varObj[`${('personA' + i + 'Phn')}`] = edge[0];
        varObj[`${('personB' + i + 'Phn')}`] = edge[1];
        nodeNames.push(('b' + i));
    }
    neo4jQuery += ' RETURN ' + nodeNames.join(',')
    varObj.timeStamp = neo4j.int(new Date().getTime());
    result.query = neo4jQuery;
    result.varObj = varObj;
    return result;
}

