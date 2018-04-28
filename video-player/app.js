var fs = require('fs');
var path = require('path');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var ping = require('ping');
const axios = require('axios');
const remoteFileWatcher = require('./NewRemoteFileWatcher');
var config = require('./config')
var configFile = config.configFile;
var isMediaServerAlive = true;

app.use(express.static(path.join(__dirname, '')));
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/app.html');
});


io.on('connection', function (socket) {
  socket.emit('adbox', "");
  console.log('connection of socket here....')
  socket.on('adbox_video_stalled', function (adboxVideo) {
    isMediaServerAlive = false;
    onVideoStalled(adboxVideo);
  });
  fetchContent();
});

var host = config.host;
var objConfig = {
  host: host,
  username: config.username,
  password: config.password,
  algorithms: {
    serverHostKey: [ 'ssh-rsa', 'ssh-dss' ],
  },
  file: config.assets
}

var count = 0;

const objRemoteFileWatcher = new remoteFileWatcher(objConfig);

objRemoteFileWatcher.on('uploading', function (objFile) {
  console.log('uploading')

});

objRemoteFileWatcher.on('uploaded', function (objFile) {
  console.log('uploaded')
  var filename = objFile.fileName;
  if (filename === configFile) {
    fetchContent()

  }

});

objRemoteFileWatcher.on('not-found', function (objFile) {
  console.log('Not found')
  io.sockets.emit('adbox', '');

});

io.sockets.on('adbox_video_stalled', function () {
  console.log('adbox_video_stalled app.js');
});

objRemoteFileWatcher.on('deleted', function (objFile) {
  console.log('deleted')
  var filename = objFile.fileName;
  if (filename === '.' + configFile + '.swp') {
    fetchContent()
  }
});

function fetchContent() {
	console.log("fetch "+config.configurl);
	count++;
	console.log(count);
  var url = config.configurl;
  axios.get(url).then(function (value) {
	  console.log(value.data);
      io.sockets.emit('adbox', value.data);
  }).catch(function (error) {
    console.log('error' + error)
  })
}

objRemoteFileWatcher.on('error', function (strServername, error) {
  console.log('ERROR: ' + strServername);
  console.log(error);
});

function checkMediaServerAlive() {
  return new Promise((resolve, reject) => {
    ping.promise.probe(host).then(resp => {
      if (resp.alive) {
        return resolve(resp)
      }
      return reject(resp)
    })
  })
}

 onVideoStalled = (adboxVideo) => {
  setTimeout(() => {
    checkMediaServerAlive().then(response => {
      //play video here
      console.log('ping success');
      isMediaServerAlive = true
      // fetchContent();
      io.sockets.emit('play-video');
    }).catch(error => {
      // error in pinging to media server
      console.log('unable to connect to media server');
      isMediaServerAlive = false
      onVideoStalled()
    })
  }, 10000)
}

// Create a webserver with a request listener callback.  This will write the response header with the content type as json, and end the response by sending the MyData array in JSON format.
server.listen(8080);
