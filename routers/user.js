var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var mysqlTool = require('../modules/mysqlTool.js');
var util = require('../modules/util.js');
var json2csv = require('json2csv');
var fs = require('fs');
var getIP = require('ipware')().get_ip;

//Mysql database API

module.exports = (function() {

    router.post('/login/:cp', function(req, res) {
		//Check params
		var ip = '127.0.0.1';
        var cp = req.params.cp;
		var checkArr = ['acc','pwd', 'type'];
        var userInfo = util.checkFormData(req, checkArr);
        if (userInfo === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		userInfo.ip = ip;
		userInfo.cp = cp;
		
        async.waterfall([
            function(next){
                mysqlTool.getUser(userInfo, function(err1, result1){
					if (err1) {
						res.send({
                            "responseCode" : '408',
                            "responseMsg" : err1.message
                        });
                        return;
					}
                    if (result1 === undefined || result1.length === 0) {
                        res.send({
                            "responseCode" : '404',
                            "responseMsg" : 'No user data'
                        });
                        return;
					}
					// Decrypt 
					var dbUser = result1[0];
					var userPwd = dbUser.userPwd;
					var decryptPwd = util.decode(userPwd, config.generalKey);
					if (decryptPwd && decryptPwd !== userInfo.pwd) {
						if(dbUser.userBlock === 1){
							res.send({
								"responseCode" : '401',
								"responseMsg" : 'user block'
							});
						}else{
							res.send({
								"responseCode" : '403',
								"responseMsg" : 'password incorrect'
							});
						}
						return;
					}
                    next(err1, dbUser);
                });
            },
            function(dbUser, next){
                mysqlTool.getGroup(dbUser.roleId, function(err2, grps){
                    next(err2, dbUser, grps);
                });
            },
            function(dbUser, grps, next){
                util.genToken(userInfo, dbUser, grps, function(token) {
                    next(null, dbUser, grps, token);
                    // 把 result4 放到下面的 rst (因為 fun3 是最後一個了)
                });
			},
            function(dbUser, grps, token, next){
				let sqlStr = 'insert into api_login_history(userId, userToken, history_login_time, history_ip, history_type, createTime) values ('+dbUser.userId+',"'+token+'", "'+util.getCurrentTime()+'", "'+userInfo.ip+'", '+userInfo.type+', "'+util.getCurrentTime()+'")';
				console.log('Insert history sql string :\n' + sqlStr);
                mysqlTool.insert(sqlStr, function(err4, historyId){
					  if (err4) {
						console.log('Insert history err' + err4);
					  } else {
						console.log('Insert history historyId :' + historyId);
					  }
					  var obj = genUserInfo(userInfo, dbUser, grps, token);
					  next(err4, obj);
					
                    // 把 result4 放到下面的 rst (因為 fun3 是最後一個了)
                });
            }
        ], function(err, rest){
            if(err) {
				
				res.send({
					"responseCode" : '999',
					"responseMsg" : err
				});
				return;
			} 
			res.send(rest);	    
		}); 
	});

	router.post('/logout', function(req, res) {
		var token = req.body.token;
		if (token === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		var ar = util.getUserTokenArr(token);
		if (ar.length !== 6) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'token fail'
			});
			return;
		}
		let sqlStr1 = 'select * from api_login_history where history_logout_time is null and userToken = "'+token+'" and userId = ' + ar[2];
		let sqlStr2 = 'update api_login_history set history_logout_time = "'+util.getCurrentTime()+'" where history_logout_time is null and userToken = "'+token+'" and userId = ' + ar[2];
		console.log('/user/logout sqlStr : \n' + sqlStr2);
		async.waterfall([
			function(next){
				mysqlTool.query(sqlStr1, function(err1, result1){
					next(err1, result1);  
				});
			},
			function(rst1, next){
				mysqlTool.update(sqlStr2, function(err2, result2){
					next(err2, rst1, result2);
				});
			}
		], function(err, rst){
			if(err) throw err;  // 匯集 err1 err2 err3
			if(rst.length >0) {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'logout success'
				});
			} else {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'alredy logout or no login data'
				});
			}
		});
	});

	//Register
	router.post('/register/:cp', function(req, res) {
		var cp = req.params.cp;
		var checkArr = ['name','pwd', 'pwd2', 'gender', 'email', 'type'];
        var userInfo = util.checkFormData(req, checkArr);
        if (userInfo === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		userInfo.cp = cp;
		if (userInfo.pwd !== userInfo.pwd2) {
			res.send({
				"responseCode" : '404',
				"responseMsg" : 'pwd&pwd2 different'
			});
			return;
		}
		//Jason add for log revord 2018.04.20 -- start 
		if (req.body.createUser) { 
			userInfo.createUser = req.body.createUser;
		}
		//Jason add for log revord 2018.04.20  -- end
		let sqlStr1 = 'select * from api_system_properties where p_name = "ACC_FORMAT" ';
		let sqlStr2 = 'select * from api_system_properties where p_name = "EMAIL_FORMAT" ';
		let sqlStr3 = 'select * from api_system_properties where p_name = "PWD_FORMAT" ';
		let sqlStr4 = 'select * from api_user where cpId =(select cpId from api_cp where cpName = "'+userInfo.cp+'") and (userName = "'+userInfo.name+'" or email = "'+userInfo.email+'")'
		async.waterfall([
			function(next){
				//Check acc format
				mysqlTool.query(sqlStr1, function(err1, result1){
					if(checkFormat(userInfo.name, result1)){
						next(err1, result1);
					} else {
						res.send({
							"responseCode" : '404',
							"responseMsg" : 'ACC_FORMAT error'
						});
					}
				});
			},
			function(rst1, next){
				mysqlTool.query(sqlStr2, function(err2, result2){
					//Check email format
					if(checkFormat(userInfo.email, result2)){
						next(err2, result2);
					} else {
						res.send({
							"responseCode" : '404',
							"responseMsg" : 'Email_FORMAT error'
						});
					}
				});
			},
			function(rst2, next){
				mysqlTool.query(sqlStr3, function(err3, result3){
					//Check pwd format
					if(checkFormat(userInfo.pwd, result3) && checkFormat(userInfo.pwd2, result3)){
						next(err3, result3);
					} else {
						res.send({
							"responseCode" : '404',
							"responseMsg" : 'PWD_FORMAT error'
						});
					}
				});
			},
			function(rst3, next){
				console.log(sqlStr4);
				mysqlTool.query(sqlStr4, function(err4, result4){
					//Check user,email is exist or not
					if (result4.length > 0) {
						res.send({
							"responseCode" : '404',
							"responseMsg" : 'username or email exists'
						});
					} else {
						next(err4, result4);
					}
				});
			},
			function(rst4, next){
				var encodePwd = util.encode(userInfo.pwd, config.generalKey);
				let role = 0
				if(userInfo.cp === 1){
					role = 29;
				}
				if(userInfo.cp === 8 || userInfo.cp == 7){
					role = 15; 
				}
				let sqlStr5 = 'insert into api_user(cpId, roleId, userName, nickName, gender, userPwd, deviceType, pic, email, userBlock, userType, createTime, createUser) values ((select cpId from api_cp where cpName = "'+userInfo.cp+'"), '+role+', "'+userInfo.name+'", "'+userInfo.name+'", "'+userInfo.gender+'", "'+encodePwd+'", '+userInfo.type+', "dummy", "'+userInfo.email+'", 0, 0, "'+util.getCurrentTime()+'", 1)'
				console.log('insert new user sql :\n' + sqlStr5);
				mysqlTool.insert(sqlStr5, function(err5, result5){
					next(err5, result5);
				});
			}
		], function(err, rst){
			if(err) {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'Query mysql error'
				});
			} else {
              if(rst) {
				var json = {type:'admin', subject:'新增帳戶', content: '帳戶名稱' + userInfo.name, createUser:userInfo.createUser};
				util.addLog(json);
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'sign up success'
				});
			  } else {
				res.send({
					"responseCode" : '999',
					"responseMsg" : 'sign up fail'
				});
			  }
			}
		});
	});

	//Get users 
	router.get('/users', function(req, res) {
		var token = req.query.token;
		var search = req.query.search;
		if (search) {
			search = util.decode(search, config.generalKey);
		}
		
		async.waterfall([
			function(next){
				util.checkAndParseToken(token, res,function(err1, result1){
					if (err1) {
						return;
					} else { 
						//Token is ok
						console.log('userInfo : ' + JSON.stringify(result1))
						let userInfo = result1.userInfo;
						let sqlStr = '';
						// if (result1.OAFlg) {
							//all user query for oa
							// sqlStr = 'select u.userId, u.cpId, u.roleId, u.userName, u.pic, u.email, u.userBlock, u.userType, u.createTime, g.expenseGrpId, g.grpName, r.roleName, case when u.userBlock = 0 then "unblock"  when u.userBlock = 1 then "block" else "unknown" end as blockDesc from api_user u left join api_user_mapping m on u.userId = m.userId left join api_expense_grp g on m.locId = g.expenseGrpId left join api_role r on u.roleId = r.roleId where u.cpId = '+userInfo.cpId;
						// } else {
							if(userInfo.dataset === 0) {
								//All user query
								sqlStr = 'select u.userId, u.cpId, u.roleId, u.userName, u.pic, u.email, u.userBlock, u.userType, u.createTime, c.cpName, r.roleName, case when u.userBlock = 0 then "unblock"  when u.userBlock = 1 then "block" else "unknown" end as blockDesc from api_user u left join api_cp c on u.cpId = c.cpId left join api_role r on u.roleId = r.roleId where 1 =1 ';
							} else if (userInfo.dataset === 1) {
								//all user by cp
								sqlStr = 'select u.userId, u.cpId, u.roleId, u.userName, u.pic, u.email, u.userBlock, u.userType, u.createTime, c.cpName, r.roleName, case when u.userBlock = 0 then "unblock"  when u.userBlock = 1 then "block" else "unknown" end as blockDesc from api_user u left join api_cp c on u.cpId = c.cpId left join api_role r on u.roleId = r.roleId where u.cpId = '+userInfo.cpId
							} else {
								res.send({
									"responseCode" : '401',
									"responseMsg" : 'no permission to access'
								});
								return;
							}
						// }	
						next(err1, sqlStr); 	  
					}
				});
			},
			function(rst1, next){
				mysqlTool.query(rst1, function(err2, result2){
					next(err2, result2);
				});
			}
		], function(err, rst){
			if(err) {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'query user fail'
				});
			} else if(rst.length > 0) {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'query success',
					"size": rst.length,
					"users": rst
				});
			} else {
				res.send({
					"responseCode" : '401',
					"responseMsg" : 'No data'
				});
			}
		});
	});

	//update user
	router.put('/users', function(req, res) {
		//Check params
		var checkArr = ['mUserId', 'catId', 'roleId','userBlock'];
        var actInfo = util.checkFormData(req, checkArr);
        if (actInfo === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		//Jason add for log revord 2018.04.20 -- start 
		if (req.body.createUser) { 
			actInfo.createUser = req.body.createUser;
		}
		if (req.body.userName) {
			actInfo.userName = req.body.userName;
		}
		//Jason add for log revord 2018.04.20  -- end
		// Jason add for fix roleId be changed by login user token roleId
		actInfo.mRoleId = actInfo.roleId

        async.waterfall([
			function(next){
				util.checkAndParseToken(req.body.token, res,function(err1, result1){
					if (err1) {
						return;
					} else { 
						//Token is ok
						actInfo = util.addJSON(actInfo, result1.userInfo);
						console.log('actInfo : ' + JSON.stringify(actInfo))
						let sqlStr = '';
						if (result1.OAFlg) {
							//all user query fo oa
							sqlStr = 'select * from api_user_mapping where userId = '+actInfo.mUserId
							next(err1, sqlStr);
						} else {
							// OAFlg = false
							if(actInfo.dataset === 0 || actInfo.dataset === 1) {
								//All user query		
								sqlStr = 'UPDATE api_user SET `cpId` = '+actInfo.catId+', `roleId` = '+actInfo.mRoleId+', `userBlock` = '+actInfo.userBlock+', `updateTime` = "'+util.getCurrentTime()+'", `updateUser` = '+actInfo.userId+' WHERE `userId` = '+actInfo.mUserId +' and cpId = '+actInfo.cpId;
								console.log('put /users sqlStr :\n' + sqlStr);
								mysqlTool.update(sqlStr, function(err, result){
									if (err) {
										res.send({
											"responseCode" : '404',
											"responseMsg" : err
										});
										return;
									} else {
										toAddUpdateLog (actInfo); 
										res.send({
											"responseCode" : '000',
											"responseMsg" : 'updata success'
										});
										return;
									}	
								});
							} else {
								res.send({
									"responseCode" : '401',
									"responseMsg" : 'no permission to access'
								});
								return;
							}
						}	
						 	  
					}
				});
			},
			function(rst1, next){
				//OAFlg = true
				//Get user mapping from api_user_mapping
				let obj = {}, sqlStr1 = '';
				mysqlTool.query(rst1, function(err2, result2){
					//Has user mapping or not?
					if(result2 && result2.length > 0) {
						//User mapping is exist
						sqlStr1 = 'UPDATE api_user_mapping SET `locId` = '+actInfo.catId+', `updateTime` = "'+util.getCurrentTime()+'", `updateUser` = '+actInfo.userId+' WHERE `userId` = '+actInfo.mUserId;
					    obj = {"isUpdate": true, "sqlstr": sqlStr1};
					} else {
						//User mapping not exist
						sqlStr1 = 'INSERT INTO api_user_mapping (`userId`, `locId`, `createTime`, `createUser`) VALUES ('+actInfo.mUserId+', '+actInfo.catId+', "'+util.getCurrentTime()+'", '+actInfo.userId+')';
						obj = {"isUpdate": false, "sqlstr": sqlStr1};
					}
					next(err2, obj);
				});
			},
			function(rst2, next){
				//New / update user mapping
				if (rst2.isUpdate) {
					mysqlTool.update(rst2.sqlstr, function(err3, result3){
						if (err3) {
							res.send({
								"responseCode" : '999',
								"responseMsg" : 'update mapping fail'
							});
							return;
						} else {
							next(err3, result3);
						}
					});
				} else {
					mysqlTool.insert(rst2.sqlstr, function(err3, result3){
						if (err3) {
							res.send({
								"responseCode" : '999',
								"responseMsg" : 'insert mapping fail'
							});
							return;
						} else {
							next(err3, result3);
						}
					});
				}
			},
			function(rst3, next){
				//Update User for oa
				let sqlStr = 'UPDATE api_user SET `roleId` = '+actInfo.mRoleId+', `userBlock` = '+actInfo.userBlock+', `updateTime` = "'+util.getCurrentTime()+'", `updateUser` = '+actInfo.userId+' WHERE `userId` = '+actInfo.mUserId +' and cpId = '+actInfo.cpId;
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
				toAddUpdateLog(actInfo); 
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'updattee success'
				});
			}
		});
	});

	//delete user
	router.delete('/users', function(req, res) {
		//Check params
		var actInfo = {};
		var token = req.query.token;
		var delUserId = req.query.delUserId;
        if (delUserId === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		actInfo.delUserId = delUserId;
		//Jason add for log record 2018.04.20 -- start 
		if (req.query.createUser) { 
			actInfo.createUser = req.query.createUser;
		}
		if (req.query.userName) {
			actInfo.userName = req.query.userName;
		}
		//Jason add for log record 2018.04.20  -- end

        async.waterfall([
			function(next){
				util.checkAndParseToken(token, res,function(err1, result1){
					if (err1) {
						return;
					} else { 
						//Token is ok
						actInfo = util.addJSON(actInfo, result1.userInfo);
						console.log('actInfo : ' + JSON.stringify(actInfo))
						let sqlStr = '';
						if (result1.OAFlg) {
							//all user query fo oa
							sqlStr = 'delete from api_user where cpId = '+actInfo.cpId +' and userId = '+actInfo.delUserId;
						} else {
							if(actInfo.dataset !== 0 && actInfo.dataset === 1) {
								sqlStr = 'delete from api_user where cpId = '+actInfo.cpId +' and userId = '+actInfo.delUserId
							} else {
								res.send({
									"responseCode" : '401',
									"responseMsg" : 'no permission to access'
								});
								return;
							}
						}
						next(err1, sqlStr);	  
					}
				});
			},
			function(rst1, next){
				//Get user mapping from api_user_mapping
				let obj = {}, sqlStr1 = '';
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
				toAddDeleteLog(actInfo);
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'delete success'
				});
			}
		});
	});

	//For taipei query
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

	return router;

})();

//For export csv to file
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

//Combine user information for login
function genUserInfo (userInfo, dbUser, grps, token) {
	let newPayload = {};
	let userData = {};
	userData['name'] = dbUser['userName'];
    userData['nickName'] = dbUser['nickName'];
    userData['gender'] = dbUser['gender'];
    userData['pic'] = dbUser['pic'];
	userData['email'] = dbUser['email'];
	userData['cp'] = userInfo['cp'];
    newPayload['userInfo'] = userData;
    newPayload['services'] = grps;
    newPayload['role'] = dbUser['roleName'];
    newPayload['authToken'] = token;
    newPayload['responseCode'] = '000';
	newPayload['responseMsg'] = 'login success';
	return newPayload;
}

//Check input field format
function checkFormat (str, result) {
	let re = new RegExp(result[0].p_value, 'g')
	return re.test(str);
}

function toAddUpdateLog (actInfo) {
	var json = {type:'admin', subject:'更新帳戶', createUser:actInfo.createUser, cp:actInfo.cpId};
	if (actInfo.userName) {
		json.content = '帳戶名稱' + actInfo.userName;
	} else {
		json.content = '帳戶Id' + actInfo.mUserId;
	}
	var remark = '';
	if (actInfo.mRoleId === 1) {
		remark = remark + '超級管理者,'; 
	} else if (actInfo.mRoleId === 8) {
		remark = remark + '一般管理者,';
	} else {
		remark = remark + '一般使用者,';
	}
	if (actInfo.userBlock === 0) {
		remark = remark + '啟用'; 
	} else if (actInfo.mRoleId === 8) {
		remark = remark + '禁用';
	} 
	json.remark = remark;
	util.addLog(json);
}

function toAddDeleteLog (actInfo) {
	var json = {type:'admin', subject:'刪除帳戶', createUser:actInfo.createUser, cp:actInfo.cpId};
	if (actInfo.userName) {
		json.content = '帳戶名稱' + actInfo.userName;
	} else {
		json.content = '帳戶Id' + actInfo.mUserId;
	}
	json.remark = '';
	util.addLog(json);
}