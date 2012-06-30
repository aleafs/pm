/*!
 * node-cluster - Multi port handler demo.
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var Master  = require('../../').Master({
  statusfile: __dirname + '/status.log',
});

/**
 * A http service
 */
Master.register('http', __dirname + '/app.js', {
  listen: [33749, '33750'],
  children: 4
});

Master.on('giveup', function (name, fatals) {
  console.warn('Master giveup to restart %s process after %d times.', name, fatals);
});

Master.on('state', function (name, current, before) {
  console.log('Process state change for %s, current: %d, before: %d', name, current, before);
});

