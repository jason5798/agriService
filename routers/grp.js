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

    //Get grp
	router.get('/grp', function(req, res) {
		var token = req.query.token;
        if (token === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
    });

    //New or Update grp
	router.post('/', function(req, res) {
		var checkArr = ['token', 'grpId', 'name'];
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
		var checkArr = ['token', 'grpId'];
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
     
