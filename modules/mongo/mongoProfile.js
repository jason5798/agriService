var mongoose = require('./mongoose');
var Schema = mongoose.Schema;
var config = require('../../config');
var debug = config.debug;

let profileSchema = new Schema({
    macAddr       : {  type: String, required: true},
    notify        : {  type: Schema.Types.Mixed, 
                    default: null, 
                    required: false},
    control       : {  type: Schema.Types.Mixed, 
                    default: null, 
                    required: false},
    controlDevice : {  type: String, required: false},
    createUser    : {  type: String, 
                    default: null, 
                    required: false},
    createTime    : {  type: Date, 
                    default: null, 
                    required: false},
    updateUser    : {  type: String, 
                    default: null, 
                    required: false},
    updateTime    : {  type: Date, 
                    default: null, 
                    required: false}
});

var ProfileModel = mongoose.model('Profile', profileSchema);

module.exports = {
    create,
    findLast,
    find,
    update,
    remove
}

function create (obj) {
    var newProfile = new ProfileModel({
        macAddr       : obj.macAddr,
        notify        : obj.notify,
        control       : obj.control,
        controlDevice : obj.controlDevice,
        createUser    : obj.createUser,
        createTime    : obj.createTime,
        updateUser    : null,
        updateTime    : null,
    });
    return new Promise(function (resolve, reject) {
        var json = {"macAddr": obj.macAddr};
        ProfileModel.find(json).sort({recv: -1}).limit(1).exec(function(err,docs){
            if(err){
                if (debug) {
                    console.log(new Date() + 'findLast err : ' + err.message);
                }
                reject(err);
            }else{
                if (docs && docs.length > 0) {
                    reject('Has same profile');
                    return;
                }
                newProfile.save(function(err, docs){
                    if(!err){
                        // console.log(now + ' Debug : Device save fail!');
                        resolve('Create profile success');
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
        ProfileModel.find(json).sort({recv: -1}).limit(1).exec(function(err,docs){
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
            }
        });
    });
}

function find (json) {
    return new Promise(function (resolve, reject) {
        ProfileModel.find(json).exec(function(err,docs){
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
        ProfileModel.update(conditions,
            json,
            {safe : true, upsert : true},
            (err, rawResponse)=>{
                if (err) {
                    if (debug) {
                        console.log(new Date() + 'update profile err : ' + err.message);
                    }
                    reject(err);
                } else {
                    if (debug) {
                        console.log(new Date() + 'update profile : ' + rawResponse);
                    }
                    resolve('Update profile success');
                }
        });
    });
}

function remove (json) {
    return new Promise(function (resolve, reject) {
        ProfileModel.remove(json, (err)=>{
            if (err) {
              console.log('Profile remove occur a error:', err);
               reject(err);
            } else {
                console.log('Delete profile success');
                resolve('Delete profile success');
            }
        });
    });
}





