const clientOptions = config.kafkaClientOptions
    kafka = require('kafka-node'),
    client = new kafka.KafkaClient(clientOptions),
    producer = new kafka.Producer(client);

module.exports = {
    produceEdges: produceEdges
}

function produceEdges(edges) {
    timestamp = new Date().valueOf()
    edges.forEach(element => {
        element.push(timestamp)
    });
    payload = [{
        topic: clientOptions.kafkaTopics[0].topic,
        messages: edges
    }]
    producer.send(payload, (err, data) => {})
}

client.createTopics(clientOptions.kafkaTopics, (error, result) => {
    if(error) {
        console.log(error)
    }else {
        console.log(`Created ${clientOptions.kafkaTopics[0].topic} and ${clientOptions.kafkaTopics[1].topic} topic`)
    }
})

producer.on('ready', () => {
    console.log("Producer is Up Now!")
})

producer.on('error', (err) => {
    console.log(err)
})