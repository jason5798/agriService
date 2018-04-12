var mqtt = require('mqtt');
var config = require('../config');

//Jason add for fix Broker need to foward message to subscriber on 2018-04-01
var options = {
	port: config.mqttPort,
    host: config.mqttHost,
    username: "apiUser",
    password: "apiPwd",
	protocolId: 'MQIsdp',
	protocolVersion: 3
};

var client = mqtt.connect(options);
client.on('connect', function()  {
	console.log(new Date() + ' ***** MQTT connect...' + client.clientId);
    client.subscribe(config.mytopic);
});

client.on('message', function(topic, message) {
	console.log(new Date() + ' ****** topic:'+topic);
	console.log('message:' + message.toString());
});

client.on('disconnect', function() {
	console.log(new Date() + ' ****** mqtt disconnect' );
});