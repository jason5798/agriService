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

//Mysql database API

module.exports = (function() {
	//Pagination settings
	var paginate = config.paginate;
	var page_limit = config.page_limit;
	//Read 
	router.get('/', function(req, res) {
		//User Token for auth
		var token = req.query.token;
		var mac = req.query.macAddr;
		if (mac === undefined || token === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
		var from = null, to = null;
		if (req.query.from)
			from = req.query.from;
		if (req.query.to)
			to = req.query.to;	

		if(req.query.paginate)
			paginate = (req.query.paginate === 'true');
		if(req.query.limit)
			page_limit = req.query.limit;
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
		var json = {macAddr: mac};
		if(from !== null && to !== null) {
			json.recv = {$gte: from, $lte: to};
		}
		// Check token then get devices

        util.checkAndParseToken(token, function(err,result){
			if (err) {
				res.send({err});
				return false;
			} else { 
				//Token is ok
				var tokenArr = result;
				mongoDevice.find(json, paginate, offset, page_limit).then(function(data) {
					// on fulfillment(已實現時)
					console.log('docs : ' + JSON.stringify(data));
					res.status(200);
					res.setHeader('Content-Type', 'application/json');
					if (paginate) {
						res.json({
							"responseCode" : '000',
							"pages" : {
								"total": data.total,
								"next": next,
								"previous": previous,
								"": Math.ceil(data.total/page_limit),
								"limit": page_limit
							},
							"data" : data.docs
						});
					} else {
						res.json({
							"responseCode" : '000',
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
	});

	router.get('/:mac', function(req, res) {
	
		var mac = req.params.mac;
		if (mac === undefined ) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
		var from = null, to = null;
		if (req.query.from)
			from = req.query.from;
		if (req.query.to)
			to = req.query.to;	

		if(req.query.paginate)
			paginate = (req.query.paginate === 'true');
		if(req.query.limit)
			page_limit = Number(req.query.limit);
		var page = 1;
		if(req.query.page)
			page = Number(req.query.page);
		var offset = (page-1) * page_limit;

		//Calculate pages
		var next = Number(page)+1;
		if(page != 1)
			var previous = Number(page)-1;
		else
			var previous = Number(page);
	    var searchMac = '.*' + mac + '.*';
		var json = {macAddr: {$regex : mac}};
		if(from !== null && to !== null) {
			json.recv = {$gte: from, $lte: to};
		}

		// Check token then get devices

        mongoDevice.find(json, paginate, offset, page_limit).then(function(data) {
			// on fulfillment(已實現時)
			console.log('docs : ' + JSON.stringify(data));
			res.status(200);
			res.setHeader('Content-Type', 'application/json');
			if (paginate) {
				toSaveCSVFile(data, page, page_limit);
				res.json({
					"responseCode" : '000',
					"pages" : {
						"total": data.total,
						"next": next,
						"previous": previous,
						"last": Math.ceil(data.total/page_limit),
						"limit": page_limit
					},
					"data" : data.docs.length
				});
			} else {
				res.json({
					"responseCode" : '000',
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
		} else {
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
		}
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
		} else {
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

	/* device mgm flow
	   params: d (mac) , token
	 */
	router.post('/device', function(req, res) {
		//Check params
		var mac = req.body.d;
		var token = req.body.token;
		var actInfo = {};
		
        if (mac === undefined) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
		} else {
			let length = mac.length -12;
			if (mac.length < 0) {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'No device to add'
				});
				return;
			}
			mac = mac.slice(length);
			mac = mac.toUpperCase();
		}
		actInfo.mac = mac;
		actInfo.token = req.body.token;
		// Jason add for temp test
		actInfo.share = 0;
		actInfo.org  = 'kqqhst';
		actInfo.type = 'LoRa';

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
						let sqlStr = 'INSERT INTO `cloudb`.`api_device_info` ( `device_mac`, `device_name`, `device_status`, `device_type`, `device_share`, `device_IoT_org`, `device_IoT_type`, `createTime`, `createUser`) VALUES ( "'+actInfo.mac+'", "'+actInfo.mac+'", 0, "'+actInfo.type+'", '+actInfo.share+', "'+actInfo.org+'", "'+actInfo.type+'", current_time(), '+actInfo.userId+') '
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
				//Check device is exist or not
				let db = 'iotp_kqqhst_default_2018-02-06';
				let searchName = 'by-eventTypeAndGwId';
				let s = 0;
				let l = 1;
				let descending = true;
				let username = "a9168397-afad-400f-b3c4-a896d9f4c249-bluemix";
                let password = "675567ac947d914b2df745c89bd90296d77b98597bc61ab08104f33aa240f238";
				let promises = [];
				const tok = username + ':' + password;
				const hash = util.encodeBase64(tok);
				const Basic = 'Basic ' + hash;
				let url = '';
				let gwArray = [];
				
				deviceList.forEach(function(device){
					let mac = device.device_mac;
					console.log('mac : ' + mac);
					let q = encodeURIComponent('["'+mac+'", "raw"]');
					url = 'https://a9168397-afad-400f-b3c4-a896d9f4c249-bluemix.cloudant.com/'+db+'/_design/iotp/_view/'+searchName+'?key='+q+'&skip='+s+'&limit='+l+'& descending='+descending;
					promises.push(axios.get(url, {headers : { 'Authorization' : Basic }}));
				});
				axios.all(promises).then(function(results) {
					for(let i = 0 ; i < deviceList.length ; i++){
						let d = deviceList[i];
						let result = results[i].data.rows;
						if(result && result.length > 0){
							d['LoRaAP'] = result[0].value.deviceId
						}else{
							d['LoRaAP'] = 'NA'
						}
						gwArray.push(d)
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
     
