var config = {};

config.port = 8000;

//Authentication
config.auth = false;

//Myaql Database
config.database = 'cloudb';
config.username = 'admin';
config.password = 'gemtek1234';
config.table_prefix = 'api_';
config.dbHost = '210.242.93.31';
config.dbPort = 3306;
//Key
config.tokenKey = 'gemtektoken';
config.pwKey = 'gemtek';
//Mongo Database
config.mongoDB = 'blazing';
//Pagination
config.paginate = true;
config.page_limit = 10;
//Zone
config.timezone = 'Asia/Taipei';
//Debug
config.debug = true;
//Server
config.server = 'http://localhost:8000/';
module.exports = config;