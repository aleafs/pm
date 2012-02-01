/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Socket  = require('net').Socket;
var TCP    = process.binding('tcp_wrap').TCP;

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
function intval (num, dft) {
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
    listen && intval(name) == name && name > 0 && listenAt(obj, name);
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

  var sub  = require('child_process').fork(path);
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

  console.log('[master] new worker forked (' + pid + ') for ' + name + '');
  obj.bindings[name].pnum++;
  obj.children[pid]  = sub;
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

  sub.on('exit', function (code) {
    obj.bindings[name].pnum--;
    delete obj.children[pid];
    delete obj.heartmsg[name][pid];
    delete obj.killings[name][pid];

    (!obj.shutdown) && startAll(obj, false, true);
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
  var cfg  = obj.bindings[name];
  if (cfg.maxc > 0 && msg.scores >= cfg.maxc && true !== del[pid] && cfg.path) {
    del[pid]  = true;
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

/* {{{ function listenAt() */
/**
 * 监听端口
 *
 * @access private
 */
function listenAt(obj, port) {
  var server  = new TCP();
  server.bind('0.0.0.0', port);
  server.listen('/dev/null');

  server.onconnection  = function (handle) {
    var pid  = fetchWorker(obj, port);
    if (!pid) {
      var res  = new Socket({
        'handle'  : handle,
      });
      res.writable  = true;
      res.end(obj.bindings[port].gone);
      res.destroy();
      return;
    }

    obj.heartmsg[port][pid].remain++;

    try {
      obj.children[pid].send({
        'type'  : MESSAGE.REQ_FD,
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

var Master    = function () {

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

}

/**
 * @注册子进程映射表
 */
Master.prototype.register  = function (name, path, cnum, gone, max_conn) {
  this.bindings[name]  = {
    'path'  : path,
    'cnum'  : intval(cnum, 1),
    'pnum'  : 0,
    'gone'  : gone ? new Buffer(gone) : RESPONSE_ON_NO_WORKER,
    'maxc'  : intval(max_conn, -1),
  };
  this.heartmsg[name]  = {};
  this.killings[name]  = {};
};

/**
 * @请求分发
 */
Master.prototype.dispatch = function () {

  var _self  = this;

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

    setInterval(function () {
      var num  = 0;
      for (var pid in _self.children) {
        num++;
      }

      if (_self.shutdown && !num) {
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
};

var Worker  = function () {

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

};

/* {{{ worker prototype ready() */
Worker.prototype.ready  = function (callback) {
  this.remain  = 0;
  this.status  = CSTATUS.RUNNING;

  function monsend (obj) {
    var msg  = {
      'remain'  : obj.remain,
      'scores'  : obj.scores,
    };

    for (var key in obj.monmsg) {
      msg[key]  = obj.monmsg[key];
    }
    msg.status  = obj.status;

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
  process.hasOwnProperty('send') && setInterval(function () {
    monsend(worker);
  }, 2000);

  /**
   * @处理FD
   */
  process.on('message', function (msg, handle) {
    if (!msg.type || MESSAGE.REQ_FD != msg.type || !handle) {
      return;
    }

    if (!callback) {
      handle.close();
      return;
    }

    worker.remain++;
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
    callback(socket);
  });

  /**
   * @信号捕捉
   */
  process.on('SIGUSR1',  function() {});
  process.on('SIGHUP',  function() {});
  process.on('SIGTERM',  function() {
    worker.status  = CSTATUS.STOPING;
    // xxx: 需要立即发送心跳作为回应, 使得master不再发送请求过来
    monsend(worker);
    setInterval(function () {
      if (worker.remain < 1 && CSTATUS.STOPING == worker.status) {
        console.log('[worker] ' + process.pid + ' terminated after ' + process.uptime() + ' seconds.');
        process.exit(0);
      }
    }, 200);
  });
};
/* }}} */

/* {{{ Worker prototype release() */
/**
 * @请求结束，释放remain资源
 */
Worker.prototype.release  = function () {
  this.scores++;
  if (this.remain > 0) {
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
}
/* }}} */

exports.MSGTYPE = MESSAGE;
exports.Master  = Master;
exports.Worker  = Worker;
