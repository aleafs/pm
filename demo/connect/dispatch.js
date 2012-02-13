/*!
 * node-cluster - demo/connect/dispatch.js, http app demo with `connect`
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var cluster = require('../..');

var master = cluster.Master();
master.register(19841, __dirname + '/app.js').dispatch();