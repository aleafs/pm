/*!
 * node-cluster - demo/connect/app.js, http app demo with `connect`
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var cluster = require('../..');
var connect = require('connect');

var app = connect(connect.static(__dirname));

app.use(function (req, res) {
  res.end(req.url + ', pid ' + process.pid);
});

var admin = cluster.Worker();
admin.ready(function (socket) {
  app.emit('connection', socket);
});