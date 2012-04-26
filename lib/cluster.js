/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Socket = require('net').Socket;
var TCP = process.binding('tcp_wrap').TCP;

function noop() {};

/**
 * @消息类型
 * @奇数表示 master -> worker
 */
var MESSAGE  = {
  RELOAD    : 2,      /**<  重新加载配置、缓存，api (msg) => master (signal) => worker */
  REQ_FD    : 11,
  HEART     : 20,
};

/**
 * @子进程状态
 */
var CSTATUS  = {
  PEDDING  : 0,      /**<  正在初始化  */
  RUNNING  : 10,      /**<  正常工作  */
  STOPING  : 20,      /**<  准备退出  */
};

/**
 * @找不到可用worker时的默认响应体
 */
var RESPONSE_ON_NO_WORKER  = new Buffer('HTTP/1.1 410 Gone\r\nServer: ANC/1.0\r\nConnection: close\r\nContent-Type: text/plain;charset=utf-8\r\nContent-Length: 169\r\nX-Expire: 300\r\nX-Message: None available workers.\r\n\r\n');

/* {{{ function intval() */
function intval(num, dft) {
  num  = parseInt(num, 10);
  dft  = parseInt(dft, 10);
  return num ? num : (dft ? dft : 0);
}
/* }}} */

/* {{{ function isport() */
function isport(num) {
  return num == intval(num, 0) && num > 0;
}
/* }}} */

/* {{{ function timestamp() */
function timestamp() {
  return intval((new Date()).getTime() / 1000, 0);
}
/* }}} */

/* {{{ function startAll() */
/**
 * 启动所有子进程
 */
function startAll(obj, listen, append) {
  if (!obj.bindings) {
    return;
  }

  for (var name in obj.bindings) {
    var cfg  = obj.bindings[name];
    var num  = (false === append) ? cfg.cnum : cfg.cnum - cfg.pnum;
    if (num > 0) {
      startName(obj, name, num);
    }
    if (listen && intval(name) == name && name > 0) {
      listenAt(obj, name);
    }
  }

  // listen port mapping
  if (listen) {
    for (var port in obj.portMapping) {
      listenAt(obj, port);
    }
  }
}
/* }}} */

/* {{{ function startName() */
/**
 * 根据名字启动子进程
 *
 * @access private
 */
function startName(obj, name, num) {
  if (!obj.bindings[name]) {
    return false;
  }

  var cfg  = obj.bindings[name];
  num  = intval(num, cfg.cnum);
  for (var i = 0; i < num; i++) {
    startWorker(obj, name, cfg.path);
  }

  return true;
}
/* }}} */

/* {{{ function startWorker() */
/**
 * 启动一个子进程
 *
 * @access private
 */
function startWorker(obj, name, path) {
  if (!obj.hasOwnProperty('children')) {
    return;
  }

  var env     = process.env;
  env.__USER  = obj.bindings[name].user;
  env.__GROUP = obj.bindings[name].group;

  var sub  = require('child_process').fork(path, obj.bindings[name].args, {
    'cwd' : process.cwd(),
    'env' : env,
  });
  var pid  = sub.pid;

  if (!obj.heartmsg[name]) {
    obj.heartmsg[name]  = {};
  }
  obj.heartmsg[name][pid]  = {
    'uptime'  : timestamp(),
    'scores'  : 0,
    'remain'  : 5,
    'status'  : CSTATUS.PEDDING,
  };

  var debugMsg = '[master] new worker forked (' + pid + ':' + path + ') for ' + name;
  var otherPorts = obj.bindings[name].otherPorts;
  if (otherPorts.length > 0) {
    debugMsg += ', ' + otherPorts.join(', ');
  }
  console.log(debugMsg);
  obj.bindings[name].pnum++;
  obj.children[pid] = sub;
  sub.on('message', function (msg) {
    if (!msg.type || !msg.data) {
      return;
    }

    switch (msg.type) {
      case MESSAGE.HEART:
        onHeartMessage(obj, name, pid, msg.data);
        break;

      case MESSAGE.RELOAD:
        onReloadMessage(obj, name, msg.data);
        break;

      default:
        break;
    }
  });

  sub.on('exit', function (code, signal) {
    obj.bindings[name].pnum--;
    delete obj.children[pid];
    delete obj.heartmsg[name][pid];
    delete obj.killings[name][pid];
    if (code && 'SIGKILL' !== signal) {
      var tmp = {};
      var now = timestamp();
      for (var idx in obj.restarts) {
        tmp[idx]    = [];
        for (var i = 0; i < obj.restarts[idx].length; i++) {
          if (obj.restarts[idx][i] > now) {
            tmp[idx].push(obj.restarts[idx][i]);
          }
        }
      }
      tmp[name].push(now + obj.options.restart_time_window);
      obj.restarts = tmp;
      if (obj.restarts[name].length > (obj.options.max_fatal_restart * obj.bindings[name].cnum)) {
        var msg = obj.restarts[name].length + ' times fatal in ' + 
          obj.options.restart_time_window + ' seconds.';
        return callEvent(obj, 'restartgiveup', name, msg);
      }
    }

    if (!obj.shutdown) {
      startAll(obj, false, true);
    }
  });
}
/* }}} */

/* {{{ function onHeartMessage() */
/**
 * 处理心跳信息
 *
 * @access private
 */
function onHeartMessage(obj, name, pid, data) {
  if (!obj.heartmsg[name]) {
    return;
  }

  if (!obj.heartmsg[name][pid]) {
    obj.heartmsg[name][pid]  = {};
  }

  var del  = obj.killings[name];
  var msg  = obj.heartmsg[name][pid];
  for (var i in data) {
    msg[i]  = data[i];
  }

  /**
   * @有新进程可用, kill待退役进程
   */
  if (msg.status == CSTATUS.RUNNING && true !== del[pid]) {
    for (var tmp in del) {
      try {
        process.kill(tmp, 'SIGTERM');
      } catch (e) {}
    }
  }

  /**
   * @最大连接数检查
   */
  var cfg = obj.bindings[name];
  if (cfg.maxc > 0 && msg.scores >= cfg.maxc && true !== del[pid] && cfg.path) {
    del[pid] = true;
    startWorker(obj, name, cfg.path);
  }
}
/* }}} */

/* {{{ function onReloadMessage() */
/**
 * 处理重载信息
 *
 * @access private
 */
function onReloadMessage(obj, name, data) {
  if (data.name) {
    push2Kill(obj, name);
  } else {
    push2Kill(obj);
  }
}
/* }}} */

/* {{{ function callEvent() */
function callEvent(obj, evt, name, msg) {
  if ('function' === typeof obj.__events[evt]) {
    obj.__events[evt](name, msg);
  }
}
/* }}} */

/* {{{ function listenAt() */
/**
 * 监听端口
 *
 * @access private
 */
function listenAt(obj, port) {
  var server = new TCP();
  server.bind('0.0.0.0', port);
  server.listen(1024);

  // 如果是映射端口，则使用第一个端口
  var name = obj.portMapping[port] || port;

  if (!obj.bindings[name]._tcp) {
    obj.bindings[name]._tcp = [ server ];
  } else {
    obj.bindings[name]._tcp.push(server);
  }

  server.onconnection = function(handle) {
    var pid = fetchWorker(obj, name);
    if (!pid) {
      var res = new Socket({
        'handle': handle,
      });
      res.writable = true;
      res.end(obj.bindings[name].gone);
      res.destroy();
      return;
    }

    obj.heartmsg[name][pid].remain++;

    try {
      obj.children[pid].send({
        type: MESSAGE.REQ_FD,
        port: port
      }, handle);
    } catch (e) {}

    handle.close();
  }
}
/* }}} */

/* {{{ function fetchWorker() */
/**
 * 选择一个worker处理请求
 *
 * @access private
 */
function fetchWorker(obj, name) {
  if (!obj.heartmsg[name]) {
    return;
  }

  var pid  = 0;
  var max  = 4294967296;

  for (var idx in obj.heartmsg[name]) {
    var sub  = obj.heartmsg[name][idx];
    if (max > sub.remain && CSTATUS.RUNNING == sub.status) {
      pid  = idx;
      max  = sub.remain;
    }
  }

  return obj.children[pid] ? pid : null;
}
/* }}} */

/* {{{ function push2Kill() */
function push2Kill(obj, name) {
  if (!obj.heartmsg) {
    return;
  }

  function killbyname(obj, name) {
    for (var pid in obj.heartmsg[name]) {
      obj.killings[name][pid]  = true;
    }
  }

  if (undefined === name || null === name) {
    for (var name in obj.heartmsg) {
      killbyname(obj, name);
    }
  } else {
    killbyname(obj, name);
  }
}
/* }}} */

function Master(options) {

  if (!(this instanceof Master)) {
    return new Master(options);
  }

  /**
   * @master参数
   */
  this.options  = {
      'max_fatal_restart'   : 5,        /**<    异常退出最大重启次数    */
      'restart_time_window' : 60,       /**<    异常重启统计时间窗口    */
      'pidfile'             : null,     /**<    进程PID文件             */
  };

  for (var i in options) {
    this.options[i] = options[i];
  }

  /**
   * @重启记录
   */
  this.restarts = {};

  /**
   * @事件回调
   */
  this.__events = {
      'restartgiveup'   : function(name, msg) {
          console.log(name + ':' + msg);
      },
  };

  /**
   * @shutdown标记
   */
  this.shutdown  = false;

  /**
   * @注册的监听分发列表
   */
  this.bindings  = {};

  /**
   * @已经启动的子进程列表
   */
  this.children  = {};

  /**
   * @心跳信息
   */
  this.heartmsg  = {};

  /**
   * @即将被kill的子进程
   */
  this.killings  = {};

  /**
   * 一批worker可以监听多个端口做映射
   * {
   *   port2: port1,
   *   port3: port1,
   *   ...
   * }
   * @type {Object}
   */
  this.portMapping = {};
}

/**
 * Register child worker infomation
 *
 * e.g.:
 *     master.register(8080, 'app.js').dispatch();
 *
 * @param {Number|String|Array[port1, port2, ...]} name, net listen port or socket file, or multi port array.
 * @param {String} path, worker start file path
 * @param {Object} option:
 *    cnum  : child nums
 *    gone  : gone message
 *    maxc  : max connections
 *    user  : uid that the worker run as
 *    group : gid that the worker run as
 *    args  : child process args
 * @param {Number} cnum, total child worker number, default is `os cpu number`
 * @param {String} gone, no handle worker response, default is `RESPONSE_ON_NO_WORKER`
 * @param {Number} max_conn, max connections, default is `-1`, no limit
 * @return {Object} the `Master` instance
 * @api public
 */
Master.prototype.register = function(name, path, option) {
  var cpus  = require('os').cpus().length;
  option  = option || {};
  var otherPorts = [];
  if (Array.isArray(name)) {
    otherPorts = name.slice(1);
    name = name[0];
  }
  this.bindings[name]  = {
    'path'  : path,
    'cnum'  : option.cnum ? intval(option.cnum, cpus) : cpus,
    'pnum'  : 0,
    'gone'  : option.gone ? new Buffer(option.gone) : RESPONSE_ON_NO_WORKER,
    'maxc'  : option.maxc ? intval(option.max_conn, -1) : -1,
    'user'  : option.user ? option.user : null,
    'group' : option.group ? option.group : null,
    'args'  : option.args ? option.args : [],
    otherPorts: otherPorts
  };
  this.heartmsg[name] = {};
  this.killings[name] = {};
  this.restarts[name] = [];
  if (otherPorts.length > 0) {
    for (var i = 0, l = otherPorts.length; i < l; i++) {
      this.portMapping[otherPorts[i]] = name; 
    }
  }

  return this;
};

/* {{{ Master prototype on() */
/**
 * Register events callback
 *
 * @param {String} event name
 * @param {Function(port, msg)} callback function, with arguments like:
 *      port : name of the worker
 *      msg : string message
 * @return {Object this}
 */
Master.prototype.on = function(evt, callback) {
  var events = {};
  if (arguments.length > 1 && ('string' === typeof evt)) {
    events[evt] = callback;
  } else {
    events = evt;
  }

  for (var idx in events) {
    if ('function' === typeof events[idx]) {
      this.__events[idx] = events[idx];
    }
  }

  return this;
}
/* }}} */

/* {{{ Master prototype dispatch() */
/**
 * @请求分发
 */
Master.prototype.dispatch = function() {

  var _self = this;
  if (_self.options.pidfile) {
    var fs  = require('fs');
    fs.writeFile(_self.options.pidfile, process.pid, function(error) {
      if (error) {
        console.log('[master] touch pidfile "' + _self.options.pidfile + '" failed.');
      } else {
        process.on('exit', function() {
          fs.unlink(_self.options.pidfile, function(error) {});
        });
      }
    });
  }

  /**
   * @启动子进程
   */
  startAll(_self, true, true);

  /**
   * @忽略HUP信号
   */
  process.on('SIGHUP',  function () {});

  /**
   * @TERM信号，优雅退出
   */
  process.on('SIGTERM', function () {
    _self.shutdown  = true;
    for (var pid in _self.children) {
      process.kill(pid, 'SIGTERM');
    }

    var interval = setInterval(function() {
      var num  = 0;
      for (var pid in _self.children) {
        num++;
      }

      if (_self.shutdown && num === 0) {
        clearInterval(interval);
        process.exit(0);
      }
    }, 200);
  });

  /**
   * @USR1信号，重启所有子进程
   */
  process.on('SIGUSR1', function () {
    push2Kill(_self);
    startAll(_self, false, false);
  });

  return this;
};
/* }}} */

/* {{{ Master prototype close() */
Master.prototype.close  = function() {
  for (var name in this.bindings) {
    var config = this.bindings[name];
    if (config._tcp) {
      for (var i = 0, l = config._tcp.length; i < l; i++) {
        config._tcp[i].close();
      }
      delete config._tcp;
    }
  }
  for (var pid in this.children) {
    process.kill(pid, 'SIGKILL');
  }
}
/* }}} */

function Worker(termTimeout) {
  if (this instanceof Worker !== true) {
    return new Worker(termTimeout);
  }

  this.termTimeout = termTimeout || -1; // terminate timeout, default is -1, no timeout

  /**
   * @未处理请求个数
   */
  this.remain  = 0;

  /**
   * @已处理请求数(keep-alive下不经过master)
   */
  this.scores  = 0;

  /**
   * @进程状态
   */
  this.status  = CSTATUS.PEDDING;

  /**
   * @动态监控信息
   */
  this.monmsg  = {};

  /**
   * @切换用户
   */
  if (process.env.__USER && 'null' != process.env.__USER) {
    try {
      process.setuid(process.env.__USER);
    } catch (e) {
      console.log('[worker] ' + e + ', ignore');
    }
  }

  /**
   * @切换用户组
   */
  if (process.env.__GROUP && 'null' != process.env.__GROUP) {
    try {
      process.setgid(process.env.__GROUP);
    } catch (e) {
      console.log('[worker] ' + e + ', ignore');
    }
  }

};

/* {{{ worker prototype ready() */
Worker.prototype.ready = function(callback) {
  this.remain  = 0;
  this.status  = CSTATUS.RUNNING;

  function monsend (obj) {
    var msg  = obj.monmsg;
    msg.status  = obj.status;
    msg.scores  = obj.scores;

    try {
      process.send({
        'type'  : MESSAGE.HEART,
        'data'  : msg,
      })
    } catch (e) {};
  }

  var worker  = this;
  monsend(worker);

  /**
   * @报告心跳
   */
  if (process.hasOwnProperty('send')) {
    setInterval(function() {
      monsend(worker);
    }, 2000);
  }

  /**
   * @处理FD
   */
  process.on('message', function (msg, handle) {
    if (!msg || MESSAGE.REQ_FD !== msg.type || !handle) {
      return;
    }

    if (!callback) {
      handle.close();
      return;
    }

    // worker.remain++;
    var socket  = new Socket({
      'handle'  : handle,
    });

    socket.readable  = true;
    socket.writable  = true;
    socket.resume();
    socket.on('error', function (err) {
      worker.release();
    });

    socket.emit('connect');
    callback(socket, msg.port);
  });

  /**
   * @信号捕捉
   */
  process.on('SIGUSR1', noop);
  process.on('SIGHUP', noop);
  process.on('SIGTERM', function() {
    worker.status  = CSTATUS.STOPING;
    // xxx: 需要立即发送心跳作为回应, 使得master不再发送请求过来
    monsend(worker);

    var termTimer = null;
    if (worker.termTimeout > 0) {
      // after `termTimeout` seconds, worker process must be killed.
      termTimer = setTimeout(function() {
        if (CSTATUS.STOPING === worker.status) {
          console.log('[worker] ' + process.pid + ' terminated timeout after ' + process.uptime() + ' seconds.');
          process.exit(0);
        }
      }, worker.termTimeout);
    }
    setInterval(function() {
      if (worker.remain < 1 && CSTATUS.STOPING === worker.status) {
        termTimer && clearTimeout(termTimer);
        console.log('[worker] ' + process.pid + ' terminated after ' + process.uptime() + ' seconds.');
        process.exit(0);
      }
    }, 200);
  });
};
/* }}} */

/* {{{ Worker prototype transact() */
/**
 * @请求开始，占用remain资源
 */
Worker.prototype.transact  = function () {
  this.remain++;
};
/* }}} */

/* {{{ Worker prototype release() */
/**
 * @请求结束，释放remain资源
 */
Worker.prototype.release  = function (remain) {
  this.scores++;
  if ('number' == (typeof arguments[0])) {
    this.remain = arguments[0];
  } else if (this.remain > 0) {
    this.remain--;
  }
};
/* }}} */

/* {{{ Worker prototype monset() */
/**
 * @设置动态监控变量
 */
Worker.prototype.monset  = function (key, value) {
  this.monmsg[key] = value;
};
/* }}} */

exports.MSGTYPE = MESSAGE;
exports.Master  = Master;
exports.Worker  = Worker;

exports.ready = function(callback) {
  var worker = new Worker();
  worker.ready(callback);
  return worker;
};
