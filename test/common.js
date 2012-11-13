/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var util = require('util');
var Emitter = require('events').EventEmitter;

exports.mockProcess = function () {

  /**
   * @ 模拟收到的消息
   */
  var message = [];

  var Process = function () {
    Emitter.call(this);
  };
  util.inherits(Process, Emitter);

  /**
   * @ 发出的消息
   */
  var msgsout = [];
  Process.prototype.send = function (msg, handle) {
    msgsout.push([msg, handle]);
  };

  Process.prototype.__getOutMessage = function () {
    return msgsout;
  };

  /**
   * @ 被触发的消息
   */
  var _events = [];
  Process.prototype.__getEvents = function () {
    return _events;
  };

  Process.prototype.emit = function (evt) {
    _events.push(arguments);
    //Emitter.emit.call(this, arguments);
  };

  Process.prototype.exit = function (code) {
    _events.push(['exit', code || 0]);
  };

  return new Process();
};
