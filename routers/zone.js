var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var util = require('../modules/util.js');
//Jason modify on 2018.05.06 for switch local and cloud db -- start
var dbZone = require('../modules/mongo/mongoZone.js');

//Jason modify on 2018.05.06 for switch local and cloud db -- end

module.exports = (function() {
    //Read
	router.get('/zones', function(req, res) {
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
                dbZone.find({}).then(function(data) {
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

	router.get('/zones/:id', function(req, res) {
		var token = req.query.token;
        var zoneId = req.params.id;
        if (zoneId === undefined || token === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
        var json = {'zoneId': zoneId};

        util.checkAndParseToken(token, res,function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                dbZone.find(json).then(function(data) {
                    // on fulfillment(已實現時)
                    var value = null;
                    if (data && data.length > 0) {
                        value = data[0];
                    }
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
					res.json({
                        "responseCode" : '000',
                        "data" : value
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

    router.post('/zones', function(req, res) {
        var checkArr = ['zoneId', 'name','deviceList','createUser'];
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
				"responseMsg" : obj.message
			});
        }
        obj.createTime = util.getCurrentUTCDate();
        if (req.body.deviceList) {
			if (util.getType(req.body.deviceList) === 'string') {
				try {
					obj.deviceList = JSON.parse(req.body.deviceList);
				} catch (error) {
					res.send({
						"responseCode" : '404',
						"responseMsg" : error.message
					});
					return;
				}
			} else {
				obj.deviceList = req.body.deviceList;
			}
		}
        util.checkAndParseToken(req.body.token, res,function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                dbZone.create(obj).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
					res.json({
                        "responseCode" : '000',
                        "responseMsg" : 'Create zone success'
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

	router.put('/zones', function(req, res) {
        var checkArr = ['zoneId', 'updateUser'];
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
				"responseMsg" : obj.message
			});
			return;
        }
        if (req.body.name) {
            obj.name = req.body.name;
        }
        obj.updateTime = util.getCurrentUTCDate();
        if (req.body.deviceList) {
			if (util.getType(req.body.deviceList) === 'string') {
				try {
					obj.deviceList = JSON.parse(req.body.deviceList);
				} catch (error) {
					res.send({
						"responseCode" : '404',
						"responseMsg" : error.message
					});
					return;
				}
			} else {
				obj.deviceList = req.body.deviceList;
			}
        }
        delete obj.zoneId;

        util.checkAndParseToken(req.body.token, res, function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                dbZone.update({"zoneId": req.body.zoneId}, obj).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
					res.json({
                        "responseCode" : '000',
                        "responseMsg" : "Update zone success"
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
	router.delete('/zones', function(req, res) {
        var name = null;
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
		if (req.query.name) {
			name = req.query.name;
		} else if (req.body.name) {
			name = req.body.name;
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
                dbZone.remove({"name": name}).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
					res.json({
                        "responseCode" : '000',
                        "responseMsg" : "Delete zone success"
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

