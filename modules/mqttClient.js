var mqtt = require('mqtt');
var config = require('../config');

var options = {
	port: config.mqttPort,
    host: config.mqttHost,
	protocolId: 'MQIsdp',
	protocolVersion: 3
};

module.exports = {
    sendMessage
}

function sendMessage(topic, message) {
	var client = mqtt.connect(options);

	// publish 'Hello mqtt' to 'test'
	client.publish(topic, message);

	// terminate the client
	client.end();
}