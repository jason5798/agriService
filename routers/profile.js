var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var util = require('../modules/util.js');
//Jason modify on 2018.05.06 for switch local and cloud db -- start
var dbProfile =  require('../modules/mongo/mongoProfile.js');

//Jason modify on 2018.05.06 for switch local and cloud db -- end

module.exports = (function() {
    //Read
	router.get('/profiles', function(req, res) {
        var token = req.query.token;
        var json = {};
        if (req.query.controlDevice) {
            json.controlDevice = req.query.controlDevice;
        }
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
                dbProfile.find(json).then(function(data) {
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

	router.get('/profiles/:macAddr', function(req, res) {
		var token = req.query.token;
        var macAddr = req.params.macAddr;
        if (macAddr === undefined || token === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
        var json = {'macAddr': macAddr};

        util.checkAndParseToken(token, res,function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                dbProfile.find(json).then(function(data) {
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

    /*notify & control example
    * {
        "notify" : {
            "temperature" : {
                "high" : {
                    "active": true,
                    "value": 30
                },
                "low": {
                    "active": false,
                    "value": 20
                }
            }
        }
      }
    */

    router.post('/profiles', function(req, res) {
        var checkArr = ['macAddr', 'createUser'];
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
        if (req.body.notify) {
			if (util.getType(req.body.notify) === 'string') {
				try {
					obj.notify = JSON.parse(req.body.notify);
				} catch (error) {
					res.send({
						"responseCode" : '404',
						"responseMsg" : error.message
					});
					return;
				}
			} else {
				obj.notify = req.body.notify;
			}
        } else {
            obj.notify = null;
        }
        if (req.body.control) {
			if (util.getType(req.body.control) === 'string') {
				try {
					obj.control = JSON.parse(req.body.control);
				} catch (error) {
					res.send({
						"responseCode" : '404',
						"responseMsg" : error.message
					});
					return;
				}
			} else {
				obj.control = req.body.control;
            }
            if (req.body.controlDevice === undefined) {
                res.send({
                    "responseCode" : '999',
                    "responseMsg" : 'Missing controlDevice'
                });
                return;
            }
        } else {
            obj.control = null;
        }
        if (req.body.controlDevice) {
            obj.controlDevice = req.body.controlDevice;
            if (req.body.control === undefined) {
                res.send({
                    "responseCode" : '999',
                    "responseMsg" : 'Missing control'
                });
                return;
            }
        } else {
            obj.controlDevice = null;
        }

        util.checkAndParseToken(req.body.token, res,function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                dbProfile.create(obj).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
					res.json({
                        "responseCode" : '000',
                        "responseMsg" : 'Create profile success'
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

	router.put('/profiles', function(req, res) {
        var checkArr = ['macAddr', 'updateUser'];
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
        obj.updateTime = util.getCurrentUTCDate();
        if (req.body.notify) {
			if (util.getType(req.body.notify) === 'string') {
				try {
					obj.notify = JSON.parse(req.body.notify);
				} catch (error) {
					res.send({
						"responseCode" : '404',
						"responseMsg" : error.message
					});
					return;
				}
			} else {
				obj.notify = req.body.notify;
			}
        }
        if (req.body.control) {
			if (util.getType(req.body.control) === 'string') {
				try {
					obj.control = JSON.parse(req.body.control);
				} catch (error) {
					res.send({
						"responseCode" : '404',
						"responseMsg" : error.message
					});
					return;
				}
			} else {
				obj.control = req.body.control;
            }
            if (req.body.controlDevice === undefined) {
                res.send({
                    "responseCode" : '999',
                    "responseMsg" : 'Missing controlDevice'
                });
                return;
            }
        }
        if (req.body.controlDevice) {
            obj.controlDevice = req.body.controlDevice;
            if (req.body.control === undefined) {
                res.send({
                    "responseCode" : '999',
                    "responseMsg" : 'Missing control'
                });
                return;
            }
        }
        delete obj.macAddr;

        util.checkAndParseToken(req.body.token, res, function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                dbProfile.update({"macAddr": req.body.macAddr}, obj).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
					res.json({
                        "responseCode" : '000',
                        "responseMsg" : "Update profile success"
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

	//Delete by macAddr
	router.delete('/profiles', function(req, res) {
		if (req.body.deviceType === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return;
		}
		util.checkAndParseToken(req.body.token, res,function(err,result){
			if (err) {
				return;
			} else {
				//Token is ok
                dbProfile.remove({"macAddr": req.body.macAddr}).then(function(data) {
                    // on fulfillment(已實現時)
                    res.status(200);
					res.setHeader('Content-Type', 'application/json');
					res.json({
                        "responseCode" : '000',
                        "responseMsg" : "Delete profile success"
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

