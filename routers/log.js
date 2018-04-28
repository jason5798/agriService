var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var mongoLog = require('../modules/mongo/mongoLog.js');
var mysqlTool = require('../modules/mysqlTool.js');
var util = require('../modules/util.js');
var json2csv = require('json2csv');
var fs = require('fs');
var axios = require('axios');


//Mysql database API

module.exports = (function() {

	
	/* log mgm flow
	   params: d (mac) , token
	 */
	router.post('/logs', function(req, res) {
		//Check params
		var checkArr = ['type','subject', 'content', 'createUser','cp'];
        var actInfo = util.checkFormData(req, checkArr);
        if (actInfo === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
        }
        if (req.body.recv) {
            actInfo.recv = req.body.recv;
        }
        if (req.body.remark) {
            actInfo.remark = req.body.remark;
        }

		async.waterfall([
			function(next){
				util.checkAndParseToken(req.body.token, res, function(err1, result1){
					if (err1) {
						return;
					} else {
						//Token is ok
						actInfo = util.addJSON(actInfo, result1.userInfo);
						console.log('actInfo : ' + JSON.stringify(actInfo));
						// check roleId
						if (actInfo.roleId !== 1) {
							// set no permission
							res.send({
								"responseCode" : '401',
								"responseMsg" : 'no permission to access'
							});
							return;
						}
						next(err1, actInfo);
					}
				});
			},
			function(rst1, next){
				//Get user mapping from api_user_mapping
                let obj = {}, sqlStr1 = '';
                var json = {type:rst1.type, subject:rst1.subject, content: rst1.content, createUser:rst1.createUser};
				if(rst1.recv === undefined || rst1.recv === null) {
                    json.recv = new Date();
                } else {
                    json.recv = rst1.recv;
                }
                if(rst1.remark === undefined || json.remark === null) {
                    json.remark= '';
                }
                
                mongoLog.saveLog(json, function(err2, result2){
                    next(err2, result2);
                });
			}
		], function(err, rst){
			if(err) {
				res.send({
					"responseCode" : '999',
					"responseMsg" : err
				});
			} else {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'insert success'
				});
			}
		});
	});

	//Update batch devices
	router.put('/device', function(req, res) {
		//Check params
		var mac = req.body.d;
		var token = req.body.token;
		var name = req.body.name;
		var actInfo = {};

        if (mac === undefined ) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		} 
		actInfo.name = name;
		actInfo.mac = mac;
		actInfo.token = req.body.token;
		// Jason add for temp test

		async.waterfall([
			function(next){
				util.checkAndParseToken(actInfo.token, res, function(err1, result1){
					if (err1) {
						return;
					} else {
						//Token is ok
						actInfo = util.addJSON(actInfo, result1.userInfo);
						console.log('actInfo : ' + JSON.stringify(actInfo));
						// check roleId
						if (actInfo.roleId !== 1) {
							// set no permission
							res.send({
								"responseCode" : '401',
								"responseMsg" : 'no permission to access'
							});
							return;
						}
						var sqlStr = 'UPDATE api_device_info SET `device_name` = "'+actInfo.name+'", `updateTime` = "'+util.getCurrentTime()+'", `updateUser` = '+actInfo.userId+' WHERE `device_mac` = "'+actInfo.mac+'"';
						console.log('/device post sqlStr :\n' + sqlStr);
						next(err1, sqlStr);
					}
				});
			},
			function(rst1, next){
				//Get user mapping from api_user_mapping
				let obj = {}, sqlStr1 = '';
				let newPayload = {}
				mysqlTool.update(rst1, function(err2, result2){
					//Has user mapping or not?
					if(result2) {
						next(err2, result2);
					} else {
						res.send({
							"responseCode" : '404',
							"responseMsg" : 'No device data'
						});
						return;
					}
				});
			}
		], function(err, rst){
			if(err) {
				res.send({
					"responseCode" : '999',
					"responseMsg" : err
				});
			} else {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'update success'
				});
			}
		});
	});

	//delete logs
	router.delete('/logs', function(req, res) {
		//Check params
		var token = req.query.token;
		var delDeviceId = req.query.delDeviceId;
		var actInfo = {};
        if (delDeviceId === undefined) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		actInfo.delDeviceId = delDeviceId;

        async.waterfall([
			function(next){
				util.checkAndParseToken(req.query.token, res,function(err1, result1){
					if (err1) {
						return;
					} else { 
						//Token is ok
						actInfo = util.addJSON(actInfo, result1.userInfo);
						console.log('actInfo : ' + JSON.stringify(actInfo))
						let sqlStr = '';
						sqlStr = 'delete from api_device_info where deviceId='+actInfo.delDeviceId;
						console.log('delete device sql : +\n' + sqlStr);
						next(err1, sqlStr);	  
					}
				});
			},
			function(rst1, next){
				//Get user mapping from api_user_mappin
				mysqlTool.remove(rst1, function(err2, result2){
					next(err2, result2);
				});
			}
		], function(err, rst){
			if(err) {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'delete fail'
				});
			} else {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'delete success'
				});
			}
		});
	});

	// JASON add for get all of sensors 
	router.get('/logs', function(req, res) {
		//User Token for auth
		var token = req.query.token;
        var type = req.query.type;
        if (req.query.from){
			var from = req.query.from;
		}

		if (req.query.to) {
		    var to = req.query.to;
		}
		let aractInfo = {};
		var json = {type: type,};
		if(from !== null && to !== null) {
			json.createTime = {$gte: from, $lte: to};
		}

		async.waterfall([
			function(next){
				util.checkAndParseToken(token, res, function(err1, result1){
					if (err1) {
						res.send({
							"responseCode" : '401',
							"responseMsg" : err1
						});
						return;
					} else {
						//Token is ok
						//Token is ok
						next(err1, result1);
					}
				});
			},
			function(rst1, next){
				//Get user mapping from api_user_mapping
				mongoLog.findLogs(json, function(err2, result2){
					if (err2) {
						console.log(util.getCurrentTime() + 'get log fail ' + err2);
						res.send({
							"responseCode" : '401',
							"responseMsg" : err2
						});
						return;
					}
					
					next(err2,  result2);
				});
			}
		], function(err, rst){
			if(err) {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'update fail'
				});
			} else if (rst) {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'query success',
					"size" : rst.length,
					"list" : rst
				});
			} else {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'query success',
					"size" : 0,
					"list" : rst
				});
			}
		});
	});

	return router;

})();

function toSaveCSVFile(data, page, limit) {
	var arr = [];
	var item = (page-1)*limit + 1;
	for(let i=0; i<data.docs.length;i++) {
		console.log('data :' + JSON.stringify(data.docs[i]));
		let doc = data.docs[i];
		let obj = {};
		obj.item = i + item;
		obj.macAddr = doc.macAddr;
		obj.date = doc.date;
		obj.fport = doc.extra.fport;
		obj.gwId = doc.extra.gwid;
		arr.push(obj);
	}
	var fields = ['item', 'macAddr', 'fport', 'gwId', 'date'];
	var csv = json2csv({ data: arr, fields: fields });
    fs.writeFile('file.csv', csv, function(err) {
		if (err) throw err;
		console.log('file saved');
	});

}

