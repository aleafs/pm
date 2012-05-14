/*!
 * node-cluster
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var http = require('http');
var cluster = require('../../');

var server37214 = http.createServer(function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
  res.end('hello world, handle port 37214');
});

var server37215 = http.createServer(function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
  res.end('hello world, handle port 37215');
});

cluster.ready(function(socket, port) {
  // console.log('%s:%s connect to %s', socket.remoteAddress, socket.remotePort, port);
  if (port == 37214) {
    server37214.emit('connection', socket);
  } else {
    server37215.emit('connection', socket);
  }
});

