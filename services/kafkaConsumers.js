const clientOptions = config.kafkaClientOptions
    kafka = require('kafka-node');

const consumerClients = []
const consumers = []
totalConsumer = 0

clientOptions.consumerHost.forEach(host => {
    client = new kafka.KafkaClient({kafkaHost: host});
    consumerClients.push(client)
    consumer = new kafka.Consumer(consumerClients[totalConsumer], [{topic: clientOptions.kafkaTopics[0].topic}])
    consumers.push(consumer)
    consumers[totalConsumer].on('message', function(message) {
        [phone1, phone2, timestamp] = message.value.split(',')
        console.log(phone1, phone2, timestamp) //todo: so something from here
    })
});