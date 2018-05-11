var mongoose = require('./mongoose');
var Schema = mongoose.Schema;
var config = require('../../config');
var debug = config.debug;

let zoneSchema = new Schema({
    zoneId     : {  type: String, required: true},
    name       : {  type: String, required: true},
    deviceList : {  type: Schema.Types.Mixed, 
                    default: null, 
                    required: false},
    createUser : {  type: String, 
                    default: null, 
                    required: false},
    createTime : {  type: Date, 
                    default: null, 
                    required: false},
    updateUser : {  type: String, 
                    default: null, 
                    required: false},
    updateTime : {  type: Date, 
                    default: null, 
                    required: false}
});

var ZoneModel = mongoose.model('Zone', zoneSchema);

module.exports = {
    create,
    findLast,
    find,
    update,
    remove
}

function create (obj) {
    var newZone = new ZoneModel({
        zoneId      : obj.zoneId,
        name        : obj.name,
        deviceList  : obj.deviceList,
        createUser  : obj.createUser,
        createTime  : obj.createTime,
        updateUser  : null,
        updateTime  : null,
    });
    return new Promise(function (resolve, reject) {
        var json = {"zoneId" : obj.zoneId};
        ZoneModel.find(json).sort({recv: -1}).limit(1).exec(function(err,docs){
            if(err){
                if (debug) {
                    console.log(new Date() + 'findLast err : ' + err.message);
                }
                reject(err);
            }else{
                var data = null;
                if (docs && docs.length > 0) {
                    reject('Has same zoneId');
                    return;
                }
                newZone.save(function(err, docs){
                    if(!err){
                        // console.log(now + ' Debug : Device save fail!');
                        resolve(docs);
                    }else{
                        // console.log(now + ' Debug : Device save success.');
                        reject(err);
                    }
                });
            }
        });
    });
}

function findLast (json) {
    return new Promise(function (resolve, reject) {
        ZoneModel.find(json).sort({recv: -1}).limit(1).exec(function(err,docs){
            if(err){
                if (debug) {
                    console.log(new Date() + 'findLast err : ' + err.message);
                }
                reject(err);
            }else{
                var doc = null;
                if (docs && docs.length > 0) {
                    doc = docs[0];
                }
                resolve(doc);
            }ata
        });
    });
}

function find (json) {
    return new Promise(function (resolve, reject) {
        ZoneModel.find(json).exec(function(err,docs){
            if(err){
                if (debug) {
                    console.log(new Date() + 'find err : ' + err.message);
                }
                reject(err);
            }else{
                if (debug) {
                    console.log(new Date() + 'find : ' + JSON.stringify(docs.length));
                }
                resolve(docs);
            }
        });
    });
}

function update (conditions, json) {
    return new Promise(function (resolve, reject) {
        ZoneModel.update(conditions,
            json,
            {safe : true, upsert : true},
            (err, rawResponse)=>{
                if (err) {
                    if (debug) {
                        console.log(new Date() + 'update zone err : ' + err.message);
                    }
                    reject(err);
                } else {
                    if (debug) {
                        console.log(new Date() + 'update zone : ' + rawResponse);
                    }
                    resolve('Update zone success');
                }
        });
    });
}

function remove (json) {
    return new Promise(function (resolve, reject) {
        ZoneModel.remove(json, (err)=>{
            if (err) {
              console.log('Delete zone occur a error:', err);
               reject(err);
            } else {
                console.log('Delete zone success');
                resolve('Delete zone success');
            }
        });
    });
}





