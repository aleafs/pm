/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Net		= require('net');
var TCP		= process.binding('tcp_wrap').TCP;

/**
 * @消息类型
 * @奇数表示 master -> worker
 */
var MESSAGE	= {
	RELOAD	: 2,			/**<	重新加载配置、缓存，api (msg) => master (signal) => worker */
	REQ_FD	: 11,
	HEART	: 20,
};

/**
 * @子进程状态
 */
var CSTATUS	= {
	PEDDING	: 0,			/**<	正在初始化	*/
	RUNNING	: 10,			/**<	正常工作	*/
	STOPING	: 20,			/**<	准备退出	*/
};

/**
 * @单进程接受的最大请求次数
 */
var MAX_REQUEST	= 1;//0000000;

/* {{{ function intval() */
function intval (num, dft) {
	try {
		num	= parseInt(num, 10);
		dft	= parseInt(dft, 10);
	} catch (e) {}

	return num || dft || 0;
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
function startAll(obj) {
	if (!obj.bindings) {
		return;
	}

	for (var name in obj.bindings) {
		startName(obj, name) && intval(name) == name && name > 0 && listenAt(obj, name);
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

	var cfg	= obj.bindings[name];
	num	= intval(num, cfg.cnum);
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

	var sub	= require('child_process').fork(path);
	var pid	= sub.pid;

	if (!obj.heartmsg[name]) {
		obj.heartmsg[name]	= {};
	}
	obj.heartmsg[name][pid]	= {
		'uptime'	: timestamp(),
		'scores'	: 0,
		'remain'	: 5,
		'status'	: CSTATUS.PEDDING,
	};

	obj.children[pid]	= sub;
	sub.on('message', function (msg) {
		if (!msg.type || !msg.data) {
			return;
		}

		switch (msg.type) {
			case MESSAGE.HEART:
				onHeartMessage(obj, name, pid, msg.data);
				break;

			case MESSAGE.RELOAD:
				onReloadMessage(obj, name, pid, msg.data);
				break;

			default:
				break;
		}
	});

	sub.on('exit', function (code, signal) {
		try {
			delete obj.children[pid];
			delete obj.heartmsg[name][pid];
		} catch (e) {}

		(!obj.shutdown) && checkWorker(obj, name);
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
		obj.heartmsg[name][pid]	= {};
	}

	var msg	= obj.heartmsg[name][pid];
	for (var i in data) {
		msg[i]	= data[i];
	}

	console.log(msg, data);
	if (data.status && CSTATUS.RUNNING == data.status) {
		try {
			var tmp	= obj.killings.pop();
			process.kill(tmp, 'SIGTERM');
		} catch (e) {}
	}
}
/* }}} */

/* {{{ function onReloadMessage() */
/**
 * 处理重载信息
 *
 * @access private
 */
function onReloadMessage(obj, name, pid, data) {
}
/* }}} */

/* {{{ function checkWorker() */
/**
 * 检查子进程数量
 *
 * @access private
 */
function checkWorker(obj, name) {
}
/* }}} */

/* {{{ function listenAt() */
/**
 * 监听端口
 *
 * @access private
 */
function listenAt(obj, port) {
	var server	= new TCP();
	server.bind('0.0.0.0', port);
	server.listen('/dev/null');
	server.onconnection	= function (handle) {
		var pid	= fetchWorker(obj, port);
		if (!pid) {
			console.log('aaaa');
			handle.close();
			return;
		}

		var sub	= obj.heartmsg[port][pid];
		sub.remain++;

		if (MAX_REQUEST > 0 && (++sub.scores) >= MAX_REQUEST ) {
			obj.killings.push(pid);
			if (obj.bindings[port] && obj.bindings[port].path) {
				startWorker(obj, port, obj.bindings[port].path);
			}
		}

		obj.children[pid].send({
			'type'	: MESSAGE.REQ_FD,
		}, handle);

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

	var pid	= 0;
	var max	= 4294967296;

	for (var idx in obj.heartmsg[name]) {
		var sub	= obj.heartmsg[name][idx];
		if (max > sub.remain && CSTATUS.RUNNING == sub.status) {
			pid	= idx;
			max	= sub.remain;
		}
	}

	return obj.children[pid] ? pid : null;
}
/* }}} */

var Master		= function () {

	/**
	 * @shutdown标记
	 */
	this.shutdown	= false;

	/**
	 * @注册的监听分发列表
	 */
	this.bindings	= {};

	/**
	 * @已经启动的子进程列表
	 */
	this.children	= {};

	/**
	 * @心跳信息
	 */
	this.heartmsg	= {};

	/**
	 * @即将被kill的子进程
	 */
	this.killings	= [];

}

/**
 * @注册子进程映射表
 */
Master.prototype.register	= function (name, path, cnum) {
	this.bindings[name]	= {
		'path'	: path,
		'cnum'	: intval(cnum, 1),
	};
	this.heartmsg[name]	= {};
};

/**
 * @请求分发
 */
Master.prototype.dispatch = function () {

	var _self	= this;

	/**
	 * @启动子进程
	 */
	startAll(_self);

	/**
	 * @忽略HUP信号
	 */
	process.on('SIGHUP',  function () {});
	
	/**
	 * @TERM信号，优雅退出
	 */
	process.on('SIGTERM', function () {
		_self.shutdown	= true;
		for (var pid in _self.children) {
			process.kill(pid, 'SIGTERM');
		}

		setInterval(function () {
			if (_self.shutdown && !_self.children) {
				process.exit(0);
			}
		}, 200);
	});

	/**
	 * @USR1信号，重启所有子进程
	 */
	process.on('SIGUSR1', function () {
		for (var pid in _self.children) {
			_self.killings.push(pid);
		}
		startAll(_self);
	});
};

var Worker	= function () {

	/**
	 * @未处理请求个数
	 */
	this.remain	= 0;

	/**
	 * @进程状态
	 */
	this.status	= CSTATUS.PEDDING;

};

/* {{{ worker prototype ready() */
Worker.prototype.ready	= function (callback) {

	this.remain	= 0;
	this.status	= CSTATUS.RUNNING;

	var worker	= this;

	/**
	 * @报告心跳
	 */
	process.hasOwnProperty('send') && setInterval(function () {
		try {
			process.send({
				'type'	: MESSAGE.HEART,
				'data'	: {
					'status'	: worker.status,
					'remain'	: worker.remain,
					'memory'	: process.memoryUsage(),
				},
			});
		} catch (e) {}
	}, 1000);

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

		var socket	= new Net.Socket({
			'handle'	: handle,
		});

		socket.readable	= true;
		socket.writable	= true;
		socket.resume();
		socket.emit('connect');

		callback(socket);
	});

	/**
	 * @信号捕捉
	 */
	process.on('SIGUSR1',	function() {});
	process.on('SIGHUP',	function() {});
	process.on('SIGTERM',	function() {
		worker.status	= CSTATUS.STOPING;
		setInterval(function () {
			if (worker.remain < 1 && CSTATUS.STOPING == worker.status) {
				console.log('[worker] ' + process.pid + ' terminated after ' + process.uptime() + ' seconds.');
				process.exit(0);
			}
		}, 100);
	});
};
/* }}} */

/**
 * @请求结束，释放remain资源
 */
Worker.prototype.release	= function () {
	if (this.remain > 0) {
		this.remain--;
	}
};
/* }}} */

exports.Master	= Master;
exports.Worker	= Worker;

