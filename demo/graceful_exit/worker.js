/*!
 * pm - demo/graceful_exit/worker.js
 * Copyright(c) 2013 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var graceful = require('graceful');
var worker = require('../../').createWorker();
var server = require('./app');

// hack for pm, because server._handle is empty.
server.close = function () {};

graceful({
  server: server,
  worker: worker,
  error: function (err) {
    console.log('[%s] [worker:%s] error: %s', new Date(), process.pid, err.stack);
  },
  killTimeout: 10000,
});

worker.ready(function (socket, port) {
  server.emit('connection', socket);
});
