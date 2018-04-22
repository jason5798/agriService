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

function findDevices (json, req, res) {
	var token = req.query.token;
		var paginate = config.paginate;
		var page_limit = config.page_limit;
		var sort = 'desc';
		var from = null, to = null;

		if (req.query.macAddr) {
			if (req.query.macAddr.length === 0 ) {
				res.send({
					"responseCode" : '999',
					"responseMsg" : 'Missing parameter'
				});
				return false;
			}
			json['macAddr'] = util.getMacString(req.query.macAddr);
		}
		if (req.query.fport) {
			json['extra.fport'] = Number(req.query.fport);
		}
		if (req.query.sort) {
			sort = req.query.sort;
		}

		if (req.query.from){
			from = util.getISODate(req.query.from);
		}

		if (req.query.to) {
		    to = util.getISODate(req.query.to);
		}

		if(req.query.paginate) {
			paginate = (req.query.paginate === 'true');
		}

		if (req.query.limit) {
			page_limit = Number(req.query.limit);
		}

		var page = 1;
		if(req.query.page)
			page = req.query.page;
		var offset = (page-1) * page_limit;

		//Calculate pages
		var next = Number(page)+1;
		if(page != 1)
			var previous = Number(page)-1;
		else
			var previous = Number(page);
		// var json = {macAddr: mac};
		if(from !== null && to !== null) {
			json.recv = {$gte: from, $lte: to};
		}
		// Check token then get devices

        util.checkAndParseToken(token, res, function(err,result){
			if (err) {
				res.send({err});
				return false;
			} else {
				//Token is ok
				console.log('**** query json :\n'+JSON.stringify(json));
				mongoDevice.find(json, paginate, offset, page_limit, sort).then(function(data) {
					// on fulfillment(已實現時)
					if (paginate) {
						console.log('find devices : ' + data.docs.length);
					} else {
						console.log('find devices : ' + data.length);
					}

					res.status(200);
					res.setHeader('Content-Type', 'application/json');
					if (paginate) {
						res.json({
							"responseCode" : '000',
							"pages" : {
								"next": next,
								"previous": previous,
								"last": Math.ceil(data.total/page_limit),
								"limit": page_limit
							},
							"total": data.total,
							"data" : data.docs
						});
					} else {
						res.json({
							"responseCode" : '000',
							"total": data.length,
							"data" : data
						});
					}
				}, function(reason) {
					// on rejection(已拒絕時)
					res.send({
						"responseCode" : '999',
						"responseMsg" : reason
					});
				});
			}
		});
}

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

	//delete user
	router.delete('/device', function(req, res) {
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
        var type = req.query.type;
        var cp = req.query.cp;
        if (req.query.from){
			from = util.getISODate(req.query.from);
		}

		if (req.query.to) {
		    to = util.getISODate(req.query.to);
		}
        let actInfo = {};
    
		actInfo.token = req.query.token;

		async.waterfall([
			function(next){
				util.checkAndParseToken(actInfo.token, res, function(err1, result1){
					if (err1) {
						return;
					} else {
						//Token is ok
						//Token is ok
						let sqlStr = '';
						actInfo = util.addJSON(actInfo, result1.userInfo);
						if (actInfo.dataset === 0) {
							// set all device query
							sqlStr = 'select deviceId, device_mac, device_name, device_status, device_active_time, device_bind_time, device_cp_id, device_user_id, device_status, device_status, device_IoT_org, device_IoT_type, case when device_status = 0 then "unopened" when device_status = 1 then "active"  when device_status = 2 then "binding" when device_status = 3 then "in used" else "unknown" end as statusDesc  from api_device_info where device_type = "LoRaM"';
						} else if (actInfo.dataset === 1) {
							// set CP device query
							sqlStr = 'select deviceId, device_mac, device_name, device_status, device_active_time, device_bind_time, device_cp_id, device_user_id, device_status, device_status, device_IoT_org, device_IoT_type, case when device_status = 0 then "unopened" when device_status = 1 then "active"  when device_status = 2 then "binding" when device_status = 3 then "in used" else "unknown" end as statusDesc  from api_device_info where device_type = "LoRaM" and device_cp_id = '+actInfo.cpId;
						} else if (actInfo.dataset === 2) {
							// set user device query
							sqlStr = 'select deviceId, device_mac, device_name, device_status, device_active_time, device_bind_time, device_cp_id, device_user_id, device_status, device_status, device_IoT_org, device_IoT_type, case when device_status = 0 then "unopened" when device_status = 1 then "active"  when device_status = 2 then "binding" when device_status = 3 then "in used" else "unknown" end as statusDesc  from api_device_info where device_type = "LoRaM" and device_user_id = '+actInfo.userId;
						} else {
							// set fail result
							res.send({
								"responseCode" : '401',
								"responseMsg" : 'Role missing'
							});
							return;
						}
						console.log('sqlStr :\n' + sqlStr);
						next(err1, sqlStr);
					}
				});
			},
			function(rst1, next){
				//Get user mapping from api_user_mapping
				mysqlTool.query(rst1, function(err2, result2){
					//Has user mapping or not?
					if(result2.length > 0) {
						//User mapping is exist
						next(err2, result2);
					} else {
						// set fail result
						res.send({
							"responseCode" : '404',
							"responseMsg" : 'No device data'
						});
						return;
					}
				});
			},
			function(deviceList, next){
				let promises = [];
				let gwArray = [];
				deviceList.forEach(function(device){
					try {
						let mac = device.device_mac;
						console.log('mac : ' + mac);
						let q = encodeURIComponent('["'+mac+'", "raw"]');
						let url = 'http://localhost:'+config.port +'/device/v1/last/'+mac;
						promises.push(axios.get(url, {headers : { 'test' : true }}));
					} catch (error) {
						console.log('???? get AP of loraM err: ' + error);
					}

				});
				axios.all(promises).then(function(results) {
					for(let i = 0 ; i < deviceList.length ; i++){
						let d = deviceList[i];
						
						try {
							let result = results[i].data.data;
							if(result)
								console.log('result : ' + JSON.stringify(result));
							if(result && result.length > 0){
								d['LoRaAP'] = result[0].extra.gwid;
								d['fport'] = result[0].extra.fport;
							}else{
								d['LoRaAP'] = 'NA';
								d['fport'] = 0;
							}
							gwArray.push(d);
						} catch (error) {
							console.log('???? get all AP of loraM and set err: ' + err);
						}
					}
					next(null, gwArray);
				});
			}
		], function(err, rst){
			if(err) {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'update fail'
				});
			} else {
				if ( rst.length > 0) {
					res.send({
						"responseCode" : '000',
						"responseMsg" : 'query success',
						"size" : rst.length,
						"mList" : rst
					});
				} else {
					res.send({
						"responseCode" : '404',
						"responseMsg" : 'No data'
					});
				}
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

