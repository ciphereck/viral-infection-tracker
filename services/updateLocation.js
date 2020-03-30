const redis = require('redis');
const neo4j = require('neo4j-driver');
const redisConn = redis.createClient({'host': config.redis.host, 'port': config.redis.port});
const driver = neo4j.driver(config.neo4j.path);
const kafka = require('./kafka')

const neo4jWriteSess = driver.session({defaultAccessMode: neo4j.session.WRITE});
const neo4jReadSess = driver.session();

module.exports = {
    updateLocationInRedis: updateLocationInRedis,
    checkSafetyForUser: checkSafetyForUser,
    registerInfection: registerInfection
};

function registerInfection(req, res) {
    let reqBody = req.body;
    let phone = reqBody.phone;
    let timeOfInfection = reqBody.time;
    if (!phone || !timeOfInfection) {
        return res.send(JSON.stringify({'success': false, 'message': 'Some info missing!'}));
    }
    let updInfectionQuery = `MATCH (p:Person{phone:$phone}) SET p+= {infected: true, infectedAt: $timeStamp} RETURN p`
    driver.session().run(updInfectionQuery, {phone: phone, timeStamp: neo4j.int(timeOfInfection)}).then(result=> {
        // session.close();
    }).catch(err => {
        console.log(`err = ${err}\nquery=${updInfectionQuery}`);
    })
    let updContactedQuery = `MATCH (p:Person{phone:$phone})-[met:MET*]->(b) WHERE any(a in met where a.at > $time15DaysBack) AND p <> b SET b+= {infectantContacted: true, infectantContactedAt: $timeStamp} RETURN p, b`
    driver.session().run(updContactedQuery, {phone: phone, time15DaysBack: neo4j.int(new Date().getTime() - config.infectedContactDays * 24 * 60 * 60 * 1000), timeStamp: neo4j.int(timeOfInfection)}).then(result=> {
        // session.close();
    }).catch(err => {
        console.log(`err = ${err}\nquery=${updContactedQuery}`);
    })
    return res.send(JSON.stringify({'success': true, 'message': 'DB updated!'}));
    //produce infected's phone and timestamp on kafka
}

function checkSafetyForUser(req, res) {
    let phone = req.params.phone;
    let flag = 'GREEN';
    let timeDiffDays = 0;
    let query = `MATCH (a:Person{phone:$phone}) RETURN a`
    neo4jReadSess.run(query, {'phone': phone})
    .then(result => {
        console.log(JSON.stringify(result.records));
        if (result.records && result.records.length) {
            let record = result.records[0];
            let properties = record._fields && record._fields.length && record._fields[0] && record._fields[0].properties;
            if (properties && typeof properties == 'object' && properties.infected) {
                timeDiffDays = (properties.infectedAt - new Date().getTime())/(1000 * 60 * 60 * 24);
                flag = 'RED';
            } else if (properties && typeof properties == 'object' && properties.infectantContacted) {
                timeDiffDays = (properties.infectantContactedAt - new Date().getTime())/(1000 * 60 * 60 * 24);
                flag = 'YELLOW';
            }
        }
        return res.send(JSON.stringify({'success': true, 'flag': flag, 'timeDiffDays': timeDiffDays}));
    })
    .catch(err=> {
        console.log(`err = ${err}`);
        return res.send(JSON.stringify({'success': false}));
    })
}

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
            kafka.produceEdges(edgesList)
            let queryParams = generateQueryForEdgeInsertion(edgesList);
            neo4jWriteSess.run(queryParams.query, queryParams.varObj)
            .catch(err=> console.log(`err = ${err}\nquery = ${queryParams.query}\nvarParams = ${JSON.stringify(queryParams.varObj)}`));
        }
    })
}

function generateQueryForEdgeInsertion(edges) {
    /*Rather Use(so as to not create multiple nodes, but multiple edges):
    MERGE (a:Person{phone:"1234"})
    MERGE (b:Person{phone:"1235"})
    CREATE (a)-[:MET{at:12346}]->(b)
    RETURN a,b
    */
    let neo4jQuery = `CREATE `
    let i = 0;
    let result = {};
    let varObj = {};
    let nodeNames = ['a'];
    let personANode = `(a:Person{phone:$personA1Phn})`;
    for (let edge of edges) {
        if (!Array.isArray(edge) || edge.length != 2) {
            continue;
        }
        i = i + 1;
        if (i > 1) {
            neo4jQuery += ',';
        }
        neo4jQuery += `${(i == 1 ? personANode : '(a)')}-[:MET{at:$timeStamp}]->(${('b' + i)}:Person{phone:${('$personB' + i + 'Phn')}})`;
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

