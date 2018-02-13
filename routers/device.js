var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var mongoDevice = require('../modules/mongo/mongoDevice.js');
var mysqlTool = require('../modules/mysqlTool.js');
var util = require('../modules/util.js');
var json2csv = require('json2csv');
var fs = require('fs');

//Mysql database API

module.exports = (function() {
	//Pagination settings
	var paginate = config.paginate;
	var page_limit = config.page_limit;
	//Read 
	router.get('/', function(req, res) {
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
     
