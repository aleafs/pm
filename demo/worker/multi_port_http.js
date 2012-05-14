/*!
 * node-cluster - demoe/worker/multi_port_http.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var http = require('http');
var cluster = require('../../');

var server33750 = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
  res.end('hello world, handle port 33750');
});

var server33751 = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
  res.end('hello world, handle port 33751');
});

cluster.ready(function (socket, port) {
  console.log('%s:%s connect to %s', socket.remoteAddress, socket.remotePort, port);
  if (port === 33750) {
    server33750.emit('connection', socket);
  } else {
    server33751.emit('connection', socket);
  }
});

