var mqtt = require('mqtt');
var config = require('../config');



module.exports = {
    sendMessage
}

function sendMessage(topic, message) {
	var options = {
		port: config.mqttPort,
		host: config.mqttHost,
		protocolId: 'MQIsdp',
		protocolVersion: 3
	};
	var client = mqtt.connect(options);
	client.on('connect', () => {
		// publish 'Hello mqtt' to 'test'
		client.publish(topic, message);

		// terminate the client
		client.end();
	})
}