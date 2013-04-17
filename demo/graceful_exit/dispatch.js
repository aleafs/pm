/*!
 * pm - demo/graceful_exit/dispatch.js
 * Copyright(c) 2013 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var pm = require('../../');

var master = pm.createMaster();

master.on('giveup', function (name, fatals, pause) {
  console.log('[%s] [master:%s] giveup to restart "%s" process after %d times. pm will try after %d ms.', 
    new Date(), process.pid, name, fatals, pause);
});

master.on('disconnect', function (name, pid) {
  // console.log('%s %s disconnect', name, pid)
  var w = master.fork(name);
  console.error('[%s] [master:%s] worker:%s disconnect! new worker:%s fork', 
    new Date(), process.pid, pid, w.process.pid);
});

master.on('fork', function (name, pid) {
  console.log('[%s] [master:%s] new %s:worker:%s fork',
    new Date(), process.pid, name, pid);
});

master.on('quit', function (name, pid, code, signal) {
  console.log('[%s] [master:%s] %s:worker:%s quit, code: %s, signal: %s',
    new Date(), process.pid, name, pid, code, signal);
});

master.register('web', __dirname + '/worker.js', {
  listen: 1984,
  children: 2
});

master.dispatch();
