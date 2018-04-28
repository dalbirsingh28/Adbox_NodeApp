var assetId = 298
var host = '192.168.7.150'
var configFile = 'videourl.json'
var assets_path = '/AdBox/Assets/' + assetId + '/'
exports.configFile = configFile
exports.host = host
exports.username = 'adbox'
exports.password = 'P@ssw0rd123'
exports.assets = '/var/www/html'+assets_path
exports.configurl = 'http://' + host + assets_path + configFile



