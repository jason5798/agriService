var mongoose = require('./mongoose.js');
var Schema = mongoose.Schema;
var moment = require('moment');
var mongoosePaginate = require('mongoose-paginate');

// create a schema
var logSchema = new Schema({
  type        : { type: String},
  subject     : { type: String},
  content     : { type: String},
  createUser  : { type: String},
  createTime  : { type: Date},
  date        : { type: String},
  cpId        : { type: String},
  remark      : { type: String}
});

console.log('logSchema id : '+logSchema._id);

// the schema is useless so far
// we need to create a model using it
var logModel = mongoose.model('Log', logSchema);

function saveLog(json,callback) {
  var time =  moment().format("YYYY-MM-DD HH:mm:ss");
  console.log(time +' Debug :save log ');
  if(json.type === 'notify'){
      var review = false;
  }else {
      var review = true;
  }
  console.log(json.recv);

  var newData = new logModel({
    type         : json.type,
    subject      : json.subject,
    content      : json.content,
    createUser   : json.createUser,
    createTime   : json.recv,
    date         : json.date,
    cpId         : json.cpId,
    remark       : json.remark
  });
  newData.save(function(err){
    if(err){
      console.log('Debug : Log save fail!/n'+err);
      return callback(err);
    }
    console.log('Debug : Log save success!');
      return callback(err,'success');
  });

};

function updateLog(logId,json,calllback) {
  console.log(moment().format('YYYY-MM-DD HH:mm:ss')+' Debug : updateLog()');

  var time =  moment().format("YYYY-MM-DD HH:mm:ss");
  json.update_at =new Date();
  json.updateTime=time;

  logModel.update({_id : logId},
    json,
    {safe : true, upsert : true},
    (err, rawResponse)=>{
      if (err) {
                console.log('Debug : update Log : '+ err);
                return calllback(err);
      } else {
                console.log('Debug : update Log : success');
          return calllback(err,'success');
        }
      }
    );
};

function updateLogByTime(time,calllback) {
   console.log(moment().format('YYYY-MM-DD HH:mm:ss')+' Debug : updateLog()');
   var json1 = {"createdTime":time};
   findLogs(json1,function(err,logs){
        if(!err){
            if(logs && logs.length>0){
                var log = logs[0];
                var id = log._id;
                var json2 = {"review":true};
                return updateLog(id,json2,calllback);
            }
        }
   });
};

/*
*Remove all of users
*Return -1:資料存取錯誤 0:刪除完成 1:刪除失敗
*/
function removeAllLOgs(calllback) {
    logModel.remove({}, (err)=>{
      console.log(moment().format('YYYY-MM-DD HH:mm:ss')+' Debug : removeAllData');
      if (err) {
        console.log('Debug :  remove all of logs occur a error:', err);
            return calllback(err);
      } else {
        console.log('Debug : remove all of logs is success.');
            return calllback(err,'success');
      }
    });
};

exports.removeAllLOgs = removeAllLOgs;

function removeLog(json,calllback) {
    logModel.remove(json, (err)=>{
      console.log(moment().format('YYYY-MM-DD HH:mm:ss')+' Debug : remove log \n'+json.stringify(json));
      if (err) {
        console.log('Debug : remove log occur a error:', err);
            return calllback(err);
      } else {
        console.log('Debug : remove log success.');
            return calllback(err,'success');
      }
    });
};

/*Find all of users
*/
function findAllLogs(calllback) {
    console.log(moment().format('YYYY-MM-DD HH:mm:ss')+' Debug : findAllLog()');
    logModel.find((err, datas) => {
      if (err) {
        console.log('Debug : findAllLog err:', err);
            return calllback(err);
      } else {
            console.log('Debug : findAllLog success\n:',datas.length);
        return calllback(err,datas);
      }
    });
};

function findLogs(json,calllback) {
    console.log(moment().format('YYYY-MM-DD HH:mm:ss')+' Debug : find logs');
    console.log(JSON.stringify(json));
    logModel.find(json, function(err,logs){
      if(err){
        return callback(err);
      }
      if (logs.length>0) {
        console.log('find '+logs.length);
        return calllback(err,logs);
      }else{
        console.log('找不到資料!');
        return calllback(err,null);
      }
    });
};

module.exports = {
    saveLog,
    updateLog,
    updateLogByTime,
    removeAllLOgs,
    removeLog,
    findAllLogs,
    findLogs
}