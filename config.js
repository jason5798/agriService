var config = {};

config.port = 8001;

//Authentication
config.auth = false;

//Base Url
config.baseurl = '/v1/';

//Myaql Database
config.database = 'cloudb';
config.dbHost = '210.242.93.31';
config.username = 'admin';
config.password = 'gemtek1234';
/*config.dbHost = '127.0.0.1';
config.username = 'root'; 
config.password = '12345678';*/
config.table_prefix = 'api_'; 
config.dbPort = 3306;
//Key
config.tokenKey = 'gemtektoken';
config.generalKey = 'gemtek';
//Mongo Database
config.mongoDB = 'mongodb://210.242.93.31/agri';
//Pagination
config.paginate = true;
config.page_limit = 10;
config.sort = 'desc';
//Zone
config.timezone = 'Asia/Taipei';
//Debug
config.debug = true;
//Server
config.server = 'http://localhost:'+ config.port + '/';
module.exports = config;