var moment = require('moment-timezone');
var mongoDevice = require('./mongo/mongoDevice.js');
var mongoMap = require('./mongo/mongoMap.js');
var config = require('../config');
var debug = true;
var CryptoJS = require("crypto-js");
var async  = require('async');
var config = require('../config');
var mysqlTool = require('./mysqlTool.js');
var debug = isDebug();
var axios = require('axios');

module.exports = {
    decode,
    encode,
    genToken,
    getUserTokenArr,
    checkDevice,
    parseMsgd,
    createMap,
    checkAndParseDeviceToken,
    checkAndParseToken,
    checkAndParseMessage,
    checkFormData,
    isDebug,
    isAuth,
    addJSON,
    getCurrentTime,
    httpGet,
    encodeBase64,
    decodeBase64
}

function httpGet(url, username, password) {
    const tok = username + ':' + password;
    const hash = encodeBase64(tok);
    const Basic = 'Basic ' + hash;
    axios.get(url, {headers : { 'Authorization' : Basic }})
    .then(response => {
        console.log(response.data.url);
        console.log(response.data.explanation);
        return response.data;
    })
    .catch(error => {
        console.log(error);
        return error;
    });
}

function isAuth () {
    return config.auth;
}

function isDebug () {
    return config.debug;
}

function encodeBase64 (codeStr) {
    return Buffer.from(codeStr).toString('base64');
}

function decodeBase64 (encodeStr) {
    return Buffer.from(encodeStr, 'base64').toString('ascii');
}

function decode (dataEncrypt, key) {
    try {				
        var encrypted  = CryptoJS.TripleDES.decrypt(dataEncrypt, key);
        return  encrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        return null;
    }
} 

function encode (dataStr, key) {
    try {
        // create a 64-bit zero filled
        var iv = CryptoJS.lib.WordArray.create(64/8);
        var ciphertext = CryptoJS.TripleDES.encrypt(dataStr, key, {iv: iv});
        var encryptedBase64 = ciphertext.toString();
        return encryptedBase64;
    } catch (error) {
        return null;
    }
} 

function genToken(userInfo, dbUser, grps, callback) {
    let grpStr = '';
    let d = new Date();
    let nowSeconds = Math.round(d.getTime() / 1000);
    if(grps && grps.length > 0){
        for (let i = 0 ; i < grps.length ; i++) {
            grpStr += grps[i].grpId;
            if ( i < grps.length - 1)
                grpStr += ',';
        }
    }
    var payload = grpStr+':'+nowSeconds+":"+dbUser.userId+":"+dbUser.cpId+":"+dbUser.roleId+":"+dbUser.dataset;
    var token = encode (payload, config.tokenKey);
    return callback(token);
    /* try {
        // create a 64-bit zero filled
        var iv = CryptoJS.lib.WordArray.create(64/8);
        
        var ciphertext = CryptoJS.TripleDES.encrypt(payload, config.tokenKey, {iv: iv});
        var encryptedBase64 = ciphertext.toString();
        return callback(null, encryptedBase64);
    } catch (error) {
        return callback(error);
    } */
}

function getUserTokenArr (token) {
    var tokenStr = decode(token, config.tokenKey);
    var tArr = tokenStr.split(':');
    return tArr;
}

function getDeviceTokenArr (token) {
    var tokenStr = decode(token, config.tokenKey);
    var tArr = tokenStr.split(':');
    return tArr;
}
  
function checkDevice(mac, callback) {
    var datas = db.getDevices(mac, function(err, devices){
        if (err) {
          // console.log('getDevices fail : ' + err);
          return callback(err);
        }
        // console.log('getDevices success : \n' + JSON.stringify(devices));
        return (null,devices);
    })
}

function parseMsgd(obj, callback) {

    if (getType(obj) === 'other') {
        return callback('Not JSON');
    }
    var fport = obj.fport.toString();
    //Get data attributes
    var mData = obj.data;
    mMac  = obj.macAddr;
    var timestamp = convertTime(obj.time);
    var tMoment = (moment.unix(timestamp/1000)).tz(config.timezone);
    var mRecv = obj.time;
    var mDate = tMoment.format('YYYY-MM-DD HH:mm:ss');

    // console.log('mRecv : '+  mRecv);
    // console.log('mDate : '+ mDate);
    var mExtra = {'gwip': obj.gwip,
              'gwid': obj.gwid,
              'rssi': obj.rssi,
              'snr' : obj.snr,
              'fport': obj.fport,
              'frameCnt': obj.frameCnt,
              'channel': obj.channel};

    //Parse data
    if(mExtra.fport){
        var mType = mExtra.fport.toString();
        mongoMap.findLast({'deviceType': fport}).then(function(doc) {
            // console.log('docs : ' + typeof doc);
            if(doc) {
                var mInfo = getTypeData(mData,doc);
                if (debug) {
                    console.log(new Date() + 'Information : ' + JSON.stringify(mInfo));
                }
                
                if(mInfo){
                    var msg = {macAddr: mMac, data: mData, timestamp: timestamp, recv: mRecv, date: mDate, extra: mExtra};
                    // console.log('**** '+msg.date +' mac:'+msg.macAddr+' => data:'+msg.data+'\ninfo:'+JSON.stringify(mInfo));
                    msg.information=mInfo;
                    
                    if (debug) {
                        console.log(new Date() + 'parseMsgd message : ' + JSON.stringify(msg));
                    }
                    return callback(null, msg);
                } else {
                    if (debug) {
                        console.log(new Date() + 'parseMsgd info is not exist');
                    }
                    return callback({"error": "Information is not exist"});
                }
            } else {
                if (debug) {
                    console.log(new Date() + 'No map for type '+ type);
                }
                return callback({"error" : "No map of type " + type});
            }
            
        }, function(reason) {
            if (debug) {
                console.log(new Date() + 'parseMsgd findLast err : ' + reason);
            }
            return callback({"error": reason});
        });
    } else {
        if (debug) {
            console.log(new Date() + 'parseMsgd fport is not exist');
        }
        return callback({"error": "fport is not exist"});
    }
}

function createMap () {
    var myobj = {
        type        : '17',
        typeName    : '土壤溫濕酸鹼電導感測',
        fieldName   :  {
                            "temperature": "溫度",
                            "ph": "酸鹼度",
                            "water": "水含量",
                            "ec": "電導度"
                        },
        map         :   { 
                            "ph": [4, 8, 11],
                            "water": [14, 18, 100],
                            "temperature": [ 18, 22, 100],
                            "ec": [22, 26, 1000]
                        },
        createUser  : 'Jason'
    };
    mongoMap.create(myobj).then(function(docs) {
        console.log('docs : ' + JSON.stringify(docs));
    }, function(reason) {
        console.log('err : ' + reason);
    });
}

function getTypeData(data,mapObj) {
    if (mapObj === undefined|| mapObj === null) {
        return null;
    }
    try {
        var obj = mapObj.map;
        var info = {};
        var keys = Object.keys(obj);
        var count = keys.length;
        for(var i =0;i<count;i++){
            //console.log( keys[i]+' : '+ obj[keys[i]]);
            info[keys[i]] = getIntData(obj[keys[i]],data);
            // console.log(keys[i] + ' : ' + info[keys[i]]);
        }
        return info;
    } catch (error) {
        return null;
    }
}

function getIntData(arrRange,initData){
    var ret = {};
    var start = arrRange[0];
    var end = arrRange[1];
    var diff = arrRange[2];
    var data = parseInt(initData.substring(start,end),16);
    // example : 
    // diff = "data/100"
    // data = 2000
    // eval(diff) = 2000/100 = 20
    
    return eval(diff);
}

function convertTime(dateStr){
    //method 1 - use convert function
    //var d = new Date();
    var d = new Date(dateStr);
    var d_ts = d.getTime(); //Date.parse('2017-09-12 00:00:00'); //get time stamp
    // console.log("showSize :"+ d);
    // console.log("showPos d_ts : " + d_ts);
    return d_ts;
}

function getType(p) {
    if (Array.isArray(p)) return 'array';
    else if (typeof p == 'string') return 'string';
    else if (p != null && typeof p == 'object') return 'object';
    else return 'other';
}

function saveMsgToDB (msg) {
    mongoDevice.create(msg).then(function(docs) {
        console.log('saveMsgToDB docs : ' + JSON.stringify(docs));
    }, function(reason) {
        console.log('saveMsgToDB err : ' + reason);
    });
}

function checkAndParseDeviceToken (token, res, callback) {
	if (!token) {
        res.send({
            "responseCode" : '999',
            "responseMsg" : 'Missing parameter'
        });
        return callback(true);
	} else if (token.length < 1){
        res.send({
            "responseCode" : '999',
            "responseMsg" : 'token length error'
        });
		return callback(true);
	}
		
	// Decrypt 
	console.log('token :\n' + token);
    var ar = getDeviceTokenArr(token);
    if (ar.length !== 5) {
        res.send({
            "responseCode" : '999',
            "responseMsg" : 'Token error'
        });
        return callback(true);
	}
    var ts = ar[1];
    var actInfo = {};
    actInfo['mac'] = ar[0];
    actInfo['ts'] = ar[1];
    actInfo['deviceId'] = ar[2];
    actInfo['grpId'] = ar[3];
    actInfo['roleId'] = ar[4];
    mysqlTool.getProperties('CERT_EXPIRE', function(err, result){
        if(err) {
            res.send({
                "responseCode" : '404',
                "responseMsg" : err
            });
            return callback(true);
        }
        if(result.length <= 0) {
            res.send({
                "responseCode" : '404',
                "responseMsg" : 'No properties data'
            });
            return callback(true);
        }
        try {
            var period = Number(result[0].p_value);
            let d = new Date();
            let nowSeconds = Math.round(d.getTime() / 1000);
            let loginSeconds = parseInt(actInfo.ts);
            let subVal = nowSeconds - loginSeconds;
            if( subVal > period || subVal < 0 ){
                res.send({
                    "responseCode" : '404',
                    "responseMsg" : 'Token expired'
                });
            }
            return callback(null, actInfo);
        } catch (error) {
            res.send({
                "responseCode" : '404',
                "responseMsg" : error
            });
            return callback(true);
        }
    });
}

function checkAndParseToken (token, res, callback) {
	if (!token) {
        res.send({
            "responseCode" : '999',
            "responseMsg" : 'Missing parameter'
        });
        return callback(true);
	} else if (token.length < 1){
        res.send({
            "responseCode" : '999',
            "responseMsg" : 'token length error'
        });
		return callback(true);
	}
		
	// Decrypt 
	console.log('token :\n' + token);
    var tArr = getUserTokenArr(token);
    var ts = tArr[1];
    var actInfo = {};
    actInfo['grp'] = tArr[0];
    actInfo['ts'] = Number(tArr[1]);
    actInfo['userId'] = Number(tArr[2]);
    actInfo['cpId'] = Number(tArr[3]);
    actInfo['roleId'] = Number(tArr[4]);
    actInfo['dataset'] = Number(tArr[5]);
    
	async.waterfall([
		function(next){
			mysqlTool.getHistory(token, function(err1, result1){
                if(result1.length <= 0) {
                    res.send({
                        "responseCode" : '404',
                        "responseMsg" : 'User already logout'
                    });
                    return callback(true);
                }
                next(err1, result1);
			});
		},
		function(rst1, next){
			mysqlTool.getProperties('TOKEN_EXPIRE', function(err2, result2){
                next(err2, [rst1, result2]);
			});
		}
	], function(errs, results){
		if(errs) {
            res.send({
                "responseCode" : '404',
                "responseMsg" : 'Query token data fail'
            });
            return callback(true);
        }
        
        //Get properties check
        if (results[1].length < 1) {
            res.send({
                "responseCode" : '404',
                "responseMsg" : 'No properties data'
            });
            return callback(true);
        }
        try {
            var period = Number(results[1].p_value);
            var d = new Date()
            var nowSeconds = Math.round(d.getTime() / 1000)
            var loginSeconds = parseInt(ts)
            let subVal = nowSeconds - loginSeconds;
            if( subVal > period || subVal < 0 ){
                res.send({
                    "responseCode" : '404',
                    "responseMsg" : 'Token expired'
                });
                return callback(true);
            }else{
                let grpStr = actInfo.grp
                let ar = grpStr.split(',')
                let accessFlg = false
                let OAFlg = false
                for(let i = 0 ; i < ar.length ; i++){
                    if(ar[i] === '22'|| ar[i] === '30'){
                        accessFlg = true
                    }
                    if(ar[i] === '8'){
                        OAFlg = true
                    }
                }
                if (accessFlg) {
                    var data = {
                        "OAFlg" : OAFlg,
                        "userInfo" : actInfo
                    };
                    return callback(null, data);
                } else {
                    res.send({
                        "responseCode" : '401',
                        "responseMsg" : 'no permission to access'
                    });
                    return callback(true);
                }
            }
        } catch (error) {
            res.send({
                "responseCode" : '404',
                "responseMsg" : error
            });
            return callback(true);
        }
	});
}

function checkAndParseMessage (message, callback) {
    if (getType(message) === 'string') {
        try {
            var mesObj = JSON.parse(message);
        } catch (error) {
            return callback(error.message);
        }
        
        if (getType(mesObj) === 'other') {
            return callback('Not JSON');
        }
        var obj = mesObj[0];
    } else if (getType(message) === 'object'){
        var obj = message;
    }
    var json = {"macAddr": obj.macAddr, "extra.frameCnt": obj.frameCnt};
    
	async.series([
		function(next){
			mongoDevice.findLast(json, function(err1, result1){
                next(err1, result1);
			});
		},
		function(next){
			parseMsgd(obj, function(err2, result2){
                next(err2, result2);
			});
		}
	], function(errs, results){
        if(errs){
            console.log(new Date() + 'checkAndParseMessage err : ' + JSON.stringify(errs));
            return callback(errs);
        } 
        // console.log('results[0] : ' + results[0]);
        // console.log('results[1] : ' + JSON.stringify(results[1]));
        if (results[0].length === 0) {
            //If no same data
            console.log('No same data, return publish message');
            //Save message to mongo database
            saveMsgToDB(results[1]);
            return callback(null, results[1]);
        } else if (results[0].length === 1){
            //If has same data then check timestamp
            var ts1 = results[0][0].timestamp;
            var ts2 = results[1].timestamp;
            // If over ond day to forward data
            if (Math.abs(ts1 -ts2) > 86400) {
                console.log('Has same data (mac,frameCnt) but timestamp is different return publish message');
                //Save message to mongo database
                saveMsgToDB(results[1]);
                return callback(null, results[1]);
            } else {
                console.log('Has same data to drop message');
                return callback({
                    "responseCode" : '401',
                    "responseMsg" : 'Has same data'
                });
            }
        }
    });
}

function checkFormData (req, checkArr) {
    try {
        var keys = '';
        var values = '';
        var keys = Object.keys(req.body);
        /* if (keys.length < checkArr.length) {
            return null;
        } */
        var count = 0;
        var json = {};
        keys.forEach(function(key,index) {
            console.log('index : ' + index + ', key : ' + key );
            if(checkArr.indexOf(key) !== -1) {
                if(key === 'map' || key === 'fieldName') {
                    json[key] = JSON.parse(req.body[key]);
                } else {
                    json[key] = req.body[key];
                }
                
                count ++;
            }
        });
        //Not include token key
        if (count !== (checkArr.length)) {
            return null;
        } else {
            delete json.token;
            return json;
        }
    } catch (error) {
        return 'Parameter format error';
    }
}

function addJSON(obj1, obj2) {
    let keys = Object.keys(obj2);
    for (let i=0;i<keys.length; i++) {
        obj1[keys[i]] = obj2[keys[i]];
    }
    return obj1;
}

function getCurrentTime() {
    var now= new Date();
    var timestamp = now.getTime(); ;
    var tMoment = (moment.unix(timestamp/1000)).tz(config.timezone);
    var mDate = tMoment.format('YYYY-MM-DD HH:mm:ss');
    return mDate;
}