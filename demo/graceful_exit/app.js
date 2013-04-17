/*!
 * pm - demo/graceful_exit/app.js
 * Copyright(c) 2013 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var http = require('http');

var server = http.createServer(function (req, res) {
  if (req.url === '/asyncerror') {
    setTimeout(function () {
      asyncError();
    }, 10);
    return;
  }
  res.end(JSON.stringify({
    url: req.url,
    pid: process.pid,
  }));
});

module.exports = server;
