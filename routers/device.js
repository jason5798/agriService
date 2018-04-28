var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var mongoDevice = require('../modules/mongo/mongoDevice.js');
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
			from = req.query.from;
		}

		if (req.query.to) {
		    to = req.query.to;
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

	//Read
	router.get('/event', function(req, res) {
		//User Token for auth
		var json = {};
		findDevices(json, req, res);
	});

	//For get last device data
	router.get('/last/:mac', function(req, res) {
		var test = req.get("test");
		if (test === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
		var mac = req.params.mac;
		if (mac.length === 0 ) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
		var json = {};
		json['macAddr'] = util.getMacString(mac);

		mongoDevice.findLast(json).then(function(data) {
			// on fulfillment(已實現時)
			res.json({
				"responseCode" : '000',
				"data" : data
			});
		}, function(reason) {
			// on rejection(已拒絕時)
			res.send({
				"responseCode" : '999',
				"responseMsg" : reason
			});
		});
	});

	/* cert flow
	   params: d (mac)
	 */
	router.post('/cert', function(req, res) {
		//Check params

		var mac = req.body.d;
        if (mac === undefined) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		} /* else {
			let length = mac.length -12;
			if (mac.length < 0) {
				res.send({
					"responseCode" : '999',
					"responseMsg" : 'mac lenth error'
				});
				return;
			}
			mac = mac.slice(length);
			mac = mac.toUpperCase();
		} */
		let sqlStr = 'select * from api_device_info where device_mac = "' + mac +'"'
			mysqlTool.query(sqlStr, function(err, result){
				if(err) {
					res.send({
						"responseCode" : '404',
						"responseMsg" : err1
					});
					return;
				}
				if (result.length === 0) {
					res.send({
						"responseCode" : '404',
						"responseMsg" : 'No device data'
					});
					return;
				}
				// Decrypt
				var deviceInfo = result[0];
				let cpId = 'LoRa'
				let roleId = 'device'
				let d = new Date()
				let nowSeconds = Math.round(d.getTime() / 1000)
				let devicePwd = deviceInfo.device_mac+':'+nowSeconds+":"+deviceInfo.deviceId+":"+cpId+":"+roleId;
				var decryptPwd = util.encode(devicePwd, config.tokenKey);
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'request success',
					"token": decryptPwd,
					"d" : deviceInfo.device_mac
				});
			});
	});

	/* config flow
	   params: d (mac) , token
	 */
	router.post('/config', function(req, res) {
		//Check params
		var mac = req.body.d;
		var token = req.body.token;
		var actInfo = {};

        if (mac === undefined) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		} 
		actInfo.d = mac;
		actInfo.token = req.body.token;

		async.waterfall([
			function(next){
				util.checkAndParseDeviceToken(actInfo.token, res, function(err1, result1){
					if (err1) {
						return;
					} else {
						//Token is ok
						actInfo = util.addJSON(actInfo, result1);
						console.log('actInfo : ' + JSON.stringify(actInfo))
						let sqlStr = 'select * from api_device_info where device_mac = "' + actInfo.d +'"';
						next(err1, sqlStr);
					}
				});
			},
			function(rst1, next){
				//Get user mapping from api_user_mapping
				let obj = {}, sqlStr1 = '';
				let newPayload = {}
				mysqlTool.query(rst1, function(err2, result2){
					//Has user mapping or not?
					if(result2.length > 0) {
						//User mapping is exist
						newPayload['status'] = result2[0].device_status;
						newPayload['deviceId'] = result2[0].device_mac;
						newPayload['deviceOrg'] = result2[0].device_IoT_org;
						newPayload['deviceType'] = result2[0].device_IoT_type ;
						if(result2[0].device_IoT_secret){
							newPayload['authToken'] = result2[0].device_IoT_secret;
						}
						if (result2[0].device_status === 2) {
							newPayload['IoTid'] = 'LoRa';
						} else if (result2[0].device_status === 1) {
							newPayload['IoTid'] = 'default';
						} else if (result2[0].device_status === 3) {
							newPayload['IoTid'] = 'act';
						} else {
							newPayload['IoTid'] = 'error';
						}
					} else {
						res.send({
							"responseCode" : '404',
							"responseMsg" : 'No device data'
						});
						return;
					}
					console.log('device token : \n' + JSON.stringify(newPayload));
					if ( newPayload.IoTid === 'LoRa' || newPayload.IoTid === 'act') {
						// check device LoRa
						// Get device from broker DB
						// Get  url = 'https://{{deviceOrg}}.internetofthings.ibmcloud.com/api/v0002/device/types/{{deviceType}}/devices/{{deviceId}}';
					} else {
						// check device PIoT
						// Get Device from local DB
						// Get url = 'https://4zirw1.internetofthings.ibmcloud.com/api/v0002/device/types/lorad/devices/{{deviceId}}';
					}
					next(err2, url);
				});
			},
			function(rst2, next){
				//Check device is exist or not

			},
			function(rst3, next){
				//Update User for oa
				let sqlStr = 'UPDATE api_user SET `roleId` = '+actInfo.roleId+', `userBlock` = '+actInfo.userBlock+', `updateTime` = "'+util.getCurrentTime()+'", `updateUser` = '+actInfo.userId+' WHERE `userId` = '+actInfo.mUserId +' and cpId = '+actInfo.cpId;
				console.log('updateuser sqlstr :\n' + sqlStr);
				mysqlTool.update(sqlStr, function(err4, result4){
					next(err4, result4);
				});
			}
		], function(err, rst){
			if(err) {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'update fail'
				});
			} else {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'update success'
				});
			}
		});


	});

	/* active flow
	   params: d (mac) , token
	 */
	router.post('/active', function(req, res) {
		//Check params
		var mac = req.body.d;
		var token = req.body.token;
		var agri =  req.body.agri;
		var actInfo = {};

        if (mac === undefined) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		} 
		if (req.body.name) {
            actInfo.name = req.body.name;
		}
		actInfo.agri =agri;
		actInfo.mac = mac;
		actInfo.token = req.body.token;

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
						let sqlStr = 'update api_device_info set device_status = 1, device_active_time = current_time(), updateTime = current_time(), device_cp_id = '+actInfo.cpId+', updateUser = ' +actInfo.userId+ ' where device_status = 0 and device_mac = "' + actInfo.mac +'"';
						//Jason add for agri sensor active
						if (actInfo.agri === 'true') {
							sqlStr = 'update api_device_info set device_status = 3, device_active_time = current_time(), updateTime = current_time(), device_cp_id = '+actInfo.cpId+', updateUser = ' +actInfo.userId+ ' where device_status = 0 and device_mac = "' + actInfo.mac +'"';
						}
						
						console.log('active sqlStr :\n' + sqlStr);
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
					"responseMsg" : 'activate fail'
				});
			} else {
				var contentStr = '裝置:' + actInfo.mac;
				if (actInfo.name) {
					contentStr = contentStr + ' 名稱:' + actInfo.name;
				}
				var json = {type:'device', subject:'啟用裝置', content: contentStr, userId: actInfo.userId, cpId: actInfo.cpId.toString()};
				util.addLog(json);
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'activate success'
				});
			}
		});


	});

	/* device mgm flow
	   params: d (mac) , token
	 */
	router.post('/device', function(req, res) {
		//Check params
		var mac = req.body.d;
		var token = req.body.token;
		var type =  req.body.type;
		var actInfo = {};

        if (mac === undefined) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		actInfo.type = type;
		actInfo.mac = mac;
		actInfo.token = req.body.token;
		// Jason add for temp test
		actInfo.share = 0;
		actInfo.org  = '';

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
						let sqlStr = 'INSERT INTO `cloudb`.`api_device_info` ( `device_mac`, `device_name`, `device_status`, `device_type`, `device_share`, `device_IoT_org`, `device_IoT_type`, `createTime`, `createUser`, `device_user_id`) VALUES ( "'+actInfo.mac+'", "'+actInfo.mac+'", 0, "'+actInfo.type+'", '+actInfo.share+', "'+actInfo.org+'", "'+actInfo.type+'", current_time(), '+actInfo.userId+','+actInfo.userId+') '
						console.log('/device post sqlStr :\n' + sqlStr);
						next(err1, sqlStr);
					}
				});
			},
			function(rst1, next){
				//Get user mapping from api_user_mapping
				let obj = {}, sqlStr1 = '';
				let newPayload = {}
				mysqlTool.insert(rst1, function(err2, result2){
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
					"responseMsg" : 'insert success'
				});
			}
		});
	});

	//New batch devices
	router.post('/batchDevices', function(req, res) {
		//Check params
		var macList = req.body.list;
		var token = req.body.token;
		var type =  req.body.type;
		var actInfo = {};

        if (macList === undefined || type === undefined) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		} 
		actInfo.macList = macList;
		actInfo.token = req.body.token;
		// Jason add for temp test
		actInfo.type = type;
		actInfo.share = 0;
		actInfo.org  = '';

		util.checkAndParseToken(actInfo.token, res, function(err1, result1){
			if (err1) {
				return;
			} else {
				//Token is ok
				let promises = [];
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
				/* ************************************************************/
				actInfo.macList.forEach(function(mac){
					try {
						console.log('mac : ' + mac);
						let url = 'http://localhost:'+config.port +'/device/v1/device';
						promises.push(axios.post(url,  { 'token' : actInfo.token, d: mac, type: actInfo.type}));
					} catch (error) {
						console.log('???? get AP of loraM err: ' + err);
					}

				});
				axios.all(promises).then(function(results) {
					for(let i = 0 ; i < results.length ; i++){
						try {
							console.log('results : ' + JSON.stringify(results[i].data));
							if (results[i].data.responseCode !== '000') {
								res.send({
									"responseCode" : '401',
									"responseMsg" : 'Add batch devices fail'
								});
								break;
								return;
							}
						} catch (error) {
							console.log('???? Add all AP of loraM and set err: ' + error);
						}
					}
					var macStr = actInfo.macList.toString();
					var json = {type:'device', subject:'新增裝置', content: '裝置:' + macStr, userId: actInfo.userId, cpId: actInfo.cpId.toString()};
				    util.addLog(json);
					res.send({
						"responseCode" : '000',
						"responseMsg" : 'Add batch device success'
					});
				});

				/* ************************************************************/
			}
		});
			
	});

	//Update devices
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
				var contentStr = '裝置:' + actInfo.mac + ' 名稱:'+ actInfo.name;
				var json = {type:'device', subject:'更新裝置', content: contentStr, userId: actInfo.userId, cpId: actInfo.cpId.toString()};
				util.addLog(json);
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
		//Jason add for log delete mac on 2018.04.28 -- start 
		if (req.query.mac) {
            actInfo.mac = req.query.mac;
		}
		if (req.query.name) {
            actInfo.name = req.query.name;
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

				var contentStr = '裝置id:' + actInfo.delDeviceId;
				if (actInfo.mac) {
					contentStr = '裝置:' + actInfo.mac;
				}
				if (actInfo.name) {
					contentStr = contentStr + ' 名稱:' + actInfo.name;
				}
				var json = {type:'device', subject:'刪除裝置', content: contentStr, userId: actInfo.userId, cpId: actInfo.cpId.toString()};
				util.addLog(json);
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'delete success'
				});
			}
		});
	});

	// JASON add for get all of sensors 
	router.get('/sensor', function(req, res) {
		//User Token for auth
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

	/* module mgm flow
	   params: dstatus (device_status) , token(user_token)
	 */
	router.get('/sensor/:dststus', function(req, res) {
		//User Token for auth
		let actInfo = {};
		actInfo.dstatus = req.params.dststus;
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
						if(actInfo.dstatus > 0)
							sqlStr += ' and device_status = '+actInfo.dstatus;
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
				//Check device is exist or not
				/* for bluemix cloudant
				let db = 'iotp_kqqhst_default_2018-02-06';
				let searchName = 'by-eventTypeAndGwId';
				let s = 0;
				let l = 1;
				let descending = true;
				let username = "a9168397-afad-400f-b3c4-a896d9f4c249-bluemix";
                let password = "675567ac947d914b2df745c89bd90296d77b98597bc61ab08104f33aa240f238";
				const tok = username + ':' + password;
				const hash = util.encodeBase64(tok);
				const Basic = 'Basic ' + hash;

				deviceList.forEach(function(device){
					let mac = device.device_mac;
					console.log('mac : ' + mac);
					let q = encodeURIComponent('["'+mac+'", "raw"]');
					leturl = 'https://a9168397-afad-400f-b3c4-a896d9f4c249-bluemix.cloudant.com/'+db+'/_design/iotp/_view/'+searchName+'?key='+q+'&skip='+s+'&limit='+l+'& descending='+descending;
					promises.push(axios.get(url, {headers : { 'Authorization' : Basic }}));
				}); */
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
						/* for bluemix cloudant data fprmat
						let result = results[i].data.rows;
						if(result && result.length > 0){
							d['LoRaAP'] = result[0].value.deviceId
						}else{
							d['LoRaAP'] = 'NA'
						} */
						// For mongoDB data format
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

	/* get gw flow
	   params: dstatus (device_status) , token(user_token)
	 */
	router.get('/gw/:dststus', function(req, res) {
		//User Token for auth
		let actInfo = {};
		actInfo.dstatus = req.params.dststus;
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
							sqlStr = 'select deviceId, device_mac, device_name, device_status, device_active_time, device_bind_time, device_cp_id, device_user_id, device_status, device_status, device_IoT_org, device_IoT_type, case when device_status = 0 then "unopened" when device_status = 1 then "active"  when device_status = 2 then "binding" when device_status = 3 then "in used" else "unknown" end as statusDesc  from api_device_info where device_type = "LoRa"';
						} else if (actInfo.dataset === 1) {
							// set CP device query
							sqlStr = 'select deviceId, device_mac, device_name, device_status, device_active_time, device_bind_time, device_cp_id, device_user_id, device_status, device_status, device_IoT_org, device_IoT_type, case when device_status = 0 then "unopened" when device_status = 1 then "active"  when device_status = 2 then "binding" when device_status = 3 then "in used" else "unknown" end as statusDesc  from api_device_info where device_type = "LoRa" and device_cp_id = '+actInfo.cpId;
						} else if (actInfo.dataset === 2) {
							// set user device query
							sqlStr = 'select deviceId, device_mac, device_name, device_status, device_active_time, device_bind_time, device_cp_id, device_user_id, device_status, device_status, device_IoT_org, device_IoT_type, case when device_status = 0 then "unopened" when device_status = 1 then "active"  when device_status = 2 then "binding" when device_status = 3 then "in used" else "unknown" end as statusDesc  from api_device_info where device_type = "LoRa" and device_user_id = '+actInfo.userId;
						} else {
							// set fail result
							res.send({
								"responseCode" : '401',
								"responseMsg" : 'Role missing'
							});
							return;
						}
						if(actInfo.dstatus > 0)
							sqlStr += ' and device_status = '+actInfo.dstatus;
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
						console.log('???? get AP of loraM err: ' + err);
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
								d['uptime'] = result[0].recv;
							}else{
								d['uptime'] = 'NA';
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

