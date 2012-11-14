/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var util = require('util');
var Emitter = require('events').EventEmitter;

exports.mockProcess = function () {

  /**
   * @ 模拟收到的消息
   */
  var message = [];

  /**
   * @ 发出的消息
   */
  var msgsout = [];

  /**
   * @ 被触发的消息
   */
  var _events = [];

  var Process = function () {
    Emitter.call(this);
  };
  util.inherits(Process, Emitter);

  Process.prototype.makesureCleanAllMessage = function () {
    message = [];
    msgsout = [];
    _events = [];
  };

  Process.prototype.send = function (msg, handle) {
    msgsout.push([msg, handle]);
  };

  Process.prototype.memoryUsage = function () {
    return {'rss' : 2, 'heapTotal' : 1, 'heapUsed' : 1};
  };

  Process.prototype.__getOutMessage = function () {
    return msgsout;
  };

  Process.prototype.__getEvents = function () {
    return _events;
  };

  Process.prototype.exit = function (code) {
    _events.push(['exit', code || 0]);
    this.emit('exit', code);
  };

  return new Process();
};

exports.mockConsole = function () {

  var message = [];

  var _me = {};
  ['log', 'error'].forEach(function (i) {
    _me[i] = function (msg) {
      message.push([i, msg]);
    };
  });

  _me.__getMessages = function () {
    return message;
  };

  return _me;
};
