var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var util = require('../modules/util.js');
var mongoMap = require('../modules/mongo/mongoMap.js');

module.exports = (function() {
    //Read
	router.get('/maps', function(req, res) {
		var token = req.query.token;
        if ( token === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}

        util.checkAndParseToken(token, res,function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                mongoMap.find({}).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
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
			}
		});
    });

	router.get('/maps/:type', function(req, res) {
		var token = req.query.token;
        var type = req.params.type;
        if (type === undefined || token === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
        var json = {'deviceType': type};

        util.checkAndParseToken(token, res,function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                mongoMap.find(json).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
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
			}
		});
	});

    router.post('/maps', function(req, res) {
        var checkArr = ['token','deviceType','typeName','fieldName','map','createUser'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
        } else if (typeof(obj) === 'string') {
            res.send({
				"responseCode" : '999',
				"responseMsg" : obj
			});
        }
        util.checkAndParseToken(req.body.token, res,function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                mongoMap.create(obj).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
					res.json({
                        "responseCode" : '000',
                        "data" : 'Create map success'
                    });
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

	router.put('/maps', function(req, res) {
        var checkArr = ['token','deviceType'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
        } else if (typeof(obj) === 'string') {
            res.send({
				"responseCode" : '999',
				"responseMsg" : obj
			});
		}
		var json = {};
		if (req.body.map) {
			json.map = req.body.map;
		}

		if (req.body.fieldName) {
			json.fieldName = req.body.fieldName;
		}

		if (req.body.updateUser) {
			json.updateUser = req.body.updateUser;
		}

		if (req.body.profile) {
			json.profile = req.body.profile;
		}


		json.updateTime = new Date();

        util.checkAndParseToken(req.body.token, res, function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                mongoMap.update({"deviceType": req.body.deviceType}, json).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
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
			}
		});
	});

	//Delete by ID
	router.delete('/maps', function(req, res) {
		var deviceType = null;
		var token = null;
		if (req.query.token) {
			token = req.query.token;
		} else if (req.body.token) {
			token = req.body.token;
		} else {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		if (req.query.deviceType) {
			deviceType = req.query.deviceType;
		} else if (req.body.deviceType) {
			deviceType = req.body.deviceType;
		} else {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		util.checkAndParseToken(token, res,function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                mongoMap.remove({"deviceType": deviceType}).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
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
			}
		});
	});

	return router;

})();

