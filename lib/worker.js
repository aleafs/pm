/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var net = require('net');
var util = require('util');

var cluster = require('cluster');
var Emitter = require('events').EventEmitter;

var NOTICE  = function () {
  console.log('[worker:%d][%s] %s', process.pid, (new Date()), 
      Array.prototype.join.call(arguments, ' '));
};

/* {{{ private function _send() */
/**
 * 向父进程发送消息
 *
 * @access private
 * @param {Number} type: see MESSAGE
 * @param {Object} data
 */
if (!process.hasOwnProperty('send')) {
  var _send = function (type, data) {
    NOTICE('_SEND', JSON.stringify({
      'type'    : type,
      'data'    : data,
    }));
  };
} else {
  var _send = function (type, data) {
    try {
      process.send({
        'type'  : type,
        'data'  : data,
      });
    } catch (e) {
      NOTICE('ERROR', e.stack);
      process.exit(0);
    }
  };
}
/* }}} */

exports.create = function (options) {

  /**
   * @ 监听句柄
   */
  var _listener = {};

  /* {{{ private function _closeAll() */
  var _closeAll = function () {
    Object.keys(_listener).forEach(function (i) {
      _listener[i].close();
    });
  };
  /* }}} */

  var Worker = function () {
    Emitter.call(this);

    var _self = this;
    process.on('SIGTERM', function () {
      _closeAll();
      _self.emit('exit');
    });
  };
  util.inherits(Worker, Emitter);

  /* {{{ public prototype setLogger() */
  Worker.prototype.setLogger = function (cb) {
    NOTICE = cb;
  };
  /* }}} */

  /* {{{ public prototype listen() */
  Worker.prototype.listen = function (port, handle) {
    var s = net.createServer(handle);
    s.listen(port, function (e) {
      if (!e) {
        _listener[port] = s;
      }
    });
  };
  /* }}} */

  return new Worker();
};

