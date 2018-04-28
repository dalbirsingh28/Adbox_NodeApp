"use strict";

const EventEmitter = require('events');
const Client = require('ssh2').Client;



module.exports = class RemoteFileWatcher extends EventEmitter
{

  /**
   * Constructor
   * @param strServerName
   * @param objConfig
   */
  constructor(strServerName, objConfig) {

    //must call super for "this" to be defined.
    super();

    // set the server name
    this.name = strServerName

    // store 'this' so it is accessible from within the callbacks
    var self = this;

    // create an sftp connection
    var conn = new Client();

    conn.on('ready', function() {
      conn.sftp(function(err, sftp) {

        if (err) {

          self.emit('error', self.name, err);
        } else {

          // loop though each folder to watch and start the 'fileWatcher' method loop
          for(var intIndex in objConfig.folders){

            self.fileWatcher(self, sftp, objConfig.folders[intIndex]);
          }
        }
      });
    }).on('error', function(err) {

      self.emit('error', self.name, err);
    }).connect(objConfig);

    // close connection when the script stops
    // ####### NEEDS TO BE TESTED WHEN RUNNING AS HEADLESS ######
    process.on('SIGINT', function()
    {
      console.log(self.name + ' connection closed \n');
      conn.end();
    });
  }

  /**
   * fileWatcher
   *
   * gets details of files on a remote path and checks them every 100 milliseconds
   * for new files and deleted files
   *
   * @param self
   * @param objFTPConnection
   * @param remotePathToWatch
   * @param arrFiledata
   */
  fileWatcher(self, objFTPConnection, remotePathToWatch, arrFiledata) {

    // get the details of the files on the remote path
    objFTPConnection.readdir(remotePathToWatch, function(err, arrNewFilelist)
    {
      if (err) self.emit('error', self.name, err);

      var arrNewFiledata = [];

      if(typeof arrFiledata !== 'undefined'){

        // if some file data exists
        // (data has been received from a previous loop of this method)

        // compare the new data to the old as it is being stored to check for any new files
        // and if any uploading files have finished uploading
        for(var intNewFileIndex in arrNewFilelist){

          // work out what the status should be and emmit an event if there
          // is a new file or change in status
          if(typeof arrFiledata[arrNewFilelist[intNewFileIndex].filename] === 'undefined'){

            // if the file is new then set the status to 'uploading' and
            // emit 'uploading' event
            var strStatus = 'uploading';
            self.emit(strStatus, {
              "serverName" : self.name,
              "folder" : remotePathToWatch,
              "fileName" : arrNewFilelist[intNewFileIndex].filename});

          } else if (arrFiledata[arrNewFilelist[intNewFileIndex].filename].status === 'uploading') {

            if(arrNewFilelist[intNewFileIndex].attrs.size > arrFiledata[arrNewFilelist[intNewFileIndex].filename].size){

              // if the size of a uploading file has increased then
              // keep the file status as 'uploading'
              var strStatus = 'uploading';
            } else {

              // if the size of a uploading file has not increased then
              // set the status to 'uploaded' and emit 'uploaded' event
              var strStatus = 'uploaded';
              self.emit(strStatus, {
                "serverName" : self.name,
                "folder" : remotePathToWatch,
                "fileName" : arrNewFilelist[intNewFileIndex].filename});
            }
          } else if (arrFiledata[arrNewFilelist[intNewFileIndex].filename].status === 'uploaded') {
            if(arrNewFilelist[intNewFileIndex].attrs.mtime > arrFiledata[arrNewFilelist[intNewFileIndex].filename].mtime) {
              console.log('executed');
              var strStatus = 'uploaded';
              self.emit(strStatus, {
                "serverName" : self.name,
                "folder" : remotePathToWatch,
                "fileName" : arrNewFilelist[intNewFileIndex].filename});
            }
          } else {

            var strStatus = 'uploaded';
          }

          // add a new file object with status and size properties to
          // the array for this directory
          arrNewFiledata[arrNewFilelist[intNewFileIndex].filename] = {
            status : strStatus,
            size : arrNewFilelist[intNewFileIndex].attrs.size,
            mtime: arrNewFilelist[intNewFileIndex].attrs.mtime
          };

          // remove the file from the existing files array
          delete arrFiledata[arrNewFilelist[intNewFileIndex].filename];
        }

        // if there are any file objects left in the old data array then
        // they no longer exist so emit a 'deleted' event
        if(Object.keys(arrFiledata).length > 0){

          for(var strDeletedFileName in arrFiledata){

            self.emit('deleted', {
              "serverName" : self.name,
              "folder" : remotePathToWatch,
              "fileName" : strDeletedFileName});
          }
        }

      } else {

        // if no file data exists
        // (this is the first loop of this method)

        for(var intNewFileIndex in arrNewFilelist){

          // add a new file object with status and size properties to
          // the array for this directory
          arrNewFiledata[arrNewFilelist[intNewFileIndex].filename] = {
            status : 'uploaded',
            size : arrNewFilelist[intNewFileIndex].attrs.size,
            mtime: arrNewFilelist[intNewFileIndex].attrs.mtime
          };
        }
      }

      // methods calls itself again after a 100 millisecond timeout
      setTimeout(function(){
        self.fileWatcher(self, objFTPConnection, remotePathToWatch, arrNewFiledata);
      }, 2000);
    });
  }
}