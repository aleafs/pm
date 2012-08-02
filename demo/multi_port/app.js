/*!
 * node-cluster - http handler worker
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var http = require('http');

var server33749 = http.createServer(function (req, res) {
  res.end('hello, I am listen on 33749.');
});

var server33750 = http.createServer(function (req, res) {
  res.end('hello, I am listen on 33750.');
});

require('../../').createWorker().ready(function (socket, port) {
  console.log('Got new connection for %d', port);
  if (port === 33749) {
    server33749.emit('connection', socket);
  } else {
    server33750.emit('connection', socket);
  }
});
