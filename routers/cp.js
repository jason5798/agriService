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
	//Login 
	router.post('/login/:cp', function(req, res) {
		var checkArr = ['acc','pwd'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
        }
    });
    
    //Logout 
	router.post('/logout', function(req, res) {
		var checkArr = ['token'];
        var obj = util.checkFormData(req, checkArr);
        if (req.body.token === undefined) {
            res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
        }
    });
    
    //Login 
	router.post('/register/:cp', function(req, res) {
		var checkArr = ['name', 'pwd', 'pwd2', 'gender', 'email', 'type'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999', 
				"responseMsg" : 'Missing parameter'
			});
        }
    });

    //Get Users 
	router.get('/users', function(req, res) {
		var token = req.query.token;
        if (token === undefined) {
			res.send({
				"responseCode" : '999',
				"responseMsg" : 'Missing parameter'
			});
			return false;
		}
    });

    //New or UpdateUsers 
	router.post('/users', function(req, res) {
		var checkArr = ['token', 'mUserId', 'catId', 'roleId', 'userBlock'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999', 
				"responseMsg" : 'Missing parameter'
			});
        }
    });

    //Delete Users 
	router.delete('/users', function(req, res) {
		var checkArr = ['token', 'delUserId'];
        var obj = util.checkFormData(req, checkArr);
        if (obj === null) {
            res.send({
				"responseCode" : '999', 
				"responseMsg" : 'Missing parameter'
			});
        }
    });

	return router;

})();
     
