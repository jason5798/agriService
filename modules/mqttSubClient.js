var mqtt = require('mqtt');
var config = require('../config');
var util = require('./util.js');
var schedule = require('node-schedule');

function scheduleCronstyle(){
    schedule.scheduleJob('30 25 11 * * *', function(){
				console.log('scheduleCronstyle:' + new Date());
				util.sendAdminLineMessage();
    }); 
}

scheduleCronstyle();

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

client.on('message', function(topic, msg) {
	console.log(new Date() + ' ****** topic:'+topic);
	console.log('message:' + msg.toString());
	util.parseMsgd(msg.toString(), function(err, message){

		if(err) {
			return;
		} else {
		  if (message) {
			console.log(util.getCurrentTime() + ' *** Publish parse and sendmessage OK');
		  }
		  return;
		}
	  });
});

client.on('disconnect', function() {
	console.log(new Date() + ' ****** mqtt disconnect' );
});