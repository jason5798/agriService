var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var mysqlTool = require('../modules/mysqlTool.js');
var util = require('../modules/util.js');
//Mysql database API

module.exports = (function() {
	//Pagination settings
	var paginate = config.paginate;
	var page_limit = config.page_limit;
	//New cp
	router.post('/', function(req, res) {
		var checkArr = ['acc','pwd'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
        }
    });

    //Get CPS 
	router.get('/cps', function(req, res) {
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
						if ( userInfo.roleId === 1) {
							//all user query fo oa
							sqlStr = 'select cpId, cpName, createTime from api_cp where 1 = 1 '
						} else {
							sqlStr = 'select cpId, cpName, createTime from api_cp where cpId = '+actInfo.cpId
						}	
						next(err1, sqlStr); 	  
					}
				});
			},
			function(rst1, next){
				mysqlTool.query(rst1, function(err2, result2){
					next(err2, result2);
				});
			}
			/*,
			function(cpList, next){
				let promises = [];
				let gwArray = [];
				cpList.forEach(function(cp){
					try {
						let sqlStr = 'select g.grpId, g.grpName, g.createTime from api_cp_mapping m left join api_grp g on m.grpId = g.grpId where m.cpId = '+cp.cpId
						//let url = 'http://localhost:'+config.port +'/device/v1/last/'+mac;
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
			}*/
		], function(err, rst){
			if(err) {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'query cps fail'
				});
			} else if(rst.length > 0) {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'query success',
					"size": rst.length,
					"grps": rst
				});
			} else {
				res.send({
					"responseCode" : '401',
					"responseMsg" : 'No Data'
				});
			}
		});
	});
	
	//Get CPS 
	router.get('/scps', function(req, res) {
		var token = req.query.token;
		var sqlStr = 'select cpId, cpName, createTime from api_cp where 1 = 1 '
		mysqlTool.query(sqlStr, function(err, result){
			if(err) {
				res.send({
					"responseCode" : '404',
					"responseMsg" : 'query cps fail'
				});
			} else if(result.length > 0) {
				res.send({
					"responseCode" : '000',
					"responseMsg" : 'query success',
					"size": result.length,
					"grps": result
				});
			} else {
				res.send({
					"responseCode" : '401',
					"responseMsg" : 'No Data'
				});
			}
		});
    });

    //New or UpdateUsers 
	router.put('/', function(req, res) {
		var checkArr = ['token', 'mUserId', 'catId', 'roleId', 'userBlock'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999', 
				"responseMsg" : 'Missing parameter'
			});
			return;
        }
    });

    //Delete Users 
	router.delete('/', function(req, res) {
		var checkArr = ['token', 'delUserId'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999', 
				"responseMsg" : 'Missing parameter'
			});
			return;
        }
    });

	return router;

})();
     
