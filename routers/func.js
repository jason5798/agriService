var express = require('express');
var router = express.Router();
var async  = require('async');
var config = require('../config');
var mysqlTool = require('../modules/mysqlTool.js');
var util = require('../modules/util.js');
//Mysql database API

module.exports = (function() {

    //Get func
	router.get('/', function(req, res) {
		var token = req.query.token;
        if (token === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
    });

    //New or Update function (if funcId = -1 for new function)
	router.post('/', function(req, res) {
        var checkArr = ['token', 'funcId', 'parentId', 'funcUrl', 
                        'sortId', 'grpId', 'hiddenFlg', 'funcName'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999', 
				"responseMsg" : 'Missing parameter'
			});
			return;
        }
    });

    //Delete grp
	router.delete('/', function(req, res) {
		var checkArr = ['token', 'funcId'];
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
     
