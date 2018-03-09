var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var mqttClient = require('../modules/mqttClient.js');
var util = require('../modules/util.js');
//Mysql database API

module.exports = (function() {
	//Pagination settings
	var paginate = config.paginate;
	var page_limit = config.page_limit;

    //Send mqtt control message
	router.post('/mqtt', function(req, res) {
        var message = req.body.message;
        var token = req.body.token;
        if (message === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
        }
        var topic = 'GIOT-GW/DL/0001C497BC0C094';
        if (req.body.topic) {
            topic = req.body.topic;
        }
        util.checkAndParseToken(token, res, function(err,result){
			if (err) {
				res.send({
					"responseCode" : '999',
					"responseMsg" : err
				});
				return false;
			} else { 
				//Token is ok
                console.log('post /control : user token vrerify is OK');
				mqttClient.sendMessage(topic,message);	
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'send message ok'
				});	  
			}
		});
    });

	return router;

})();