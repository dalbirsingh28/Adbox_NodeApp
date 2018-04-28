"use strict";
const EventEmitter = require('events');
const Client = require('ssh2').Client;
let config = require('./config');

module.exports = class NewRemoteFileWatcher extends EventEmitter
{
  constructor(objConfig) {
    super();
    let that = this;
    this.lastUpdated = (new Date()).getTime();
    this.fileToWatch = config.configFile;
    this.notFound = false;
    let conn;
    this.createConnection(that, objConfig);

    process.on('SIGINT',  () => {
      that.conn.end();
      console.log('\n closed connection');
      process.exit()
    })

  }

  createConnection (that, objConfig) {
    console.log('Creating connection');
    that.conn = new Client();

    that.conn.on('ready', () => {
      that.conn.sftp(function (error, sftp) {
        if (error) that.emit('error', error);
        //call to watch function
        that.fileWatcher(that, sftp, objConfig.file)
      })
      console.log('Connection ready');
    }).on('error', function (error) {
      that.emit('error', error);
      setTimeout(() => {
        that.createConnection(that, objConfig);
      }, 60000);
      console.log('Trying to create new connection');
    }).on('close', function () {
      console.log('connection is closed.');
    }).connect(objConfig)
  }


  fileWatcher (that, conn, path, prevData) {
    that.fileContents = [];
    conn.readdir(path, function (error, fileList) {
      that.fileContents = fileList
      if (prevData) {
        var find = 0;
        that.fileContents.forEach(function (file) {
          if (file.filename === that.fileToWatch) {
            find = 1
            that.notFound = false
            if (file.attrs.mtime > that.lastUpdated) {
              var strStatus = 'uploaded';
              that.emit(strStatus, {
                "folder" : path,
                "fileName" : that.fileToWatch})
              that.lastUpdated = parseInt(file.attrs.mtime.toString().substring(0,10))
              prevData.push(file)
            }
          }
        })
        if (find === 0) {
          var strStatus = 'not-found'
          if (!that.notFound) {
            that.emit(strStatus, {
              "folder"  : path,
              "fileName" : that.fileToWatch})
            that.notFound = true
          }
          prevData = []
        }

      } else {
        var find = 0
        that.fileContents.forEach(function (file) {
          if (file.filename === that.fileToWatch) {
            find = 1
            var strStatus = 'uploaded';
            that.emit(strStatus, {
              "folder" : path,
              "fileName" : that.fileToWatch})
            that.lastUpdated = file.attrs.mtime
            prevData = []
            prevData.push(file)
          }
        })
        if (find === 0) {
          var strStatus = 'not-found';
          that.emit(strStatus, {
            "folder" : path,
            "fileName" : that.fileToWatch})
          prevData = []
        }
      }

      setTimeout(function () {
        that.fileWatcher(that, conn, path, prevData)
      }, 2000)

    })

  }

}