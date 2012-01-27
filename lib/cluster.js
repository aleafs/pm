/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Child	= require('child_process');
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

/* {{{ function intval() */
function intval (num, dft) {
	try {
		num	= parseInt(num);
		dft	= parseInt(dft);
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

var Master		= {

	/**
	 * @shutdown标记
	 */
	'shutdown'	: false,

	/**
	 * @注册的监听分发列表
	 */
	'bindings'	: {},

	/**
	 * @已经启动的子进程列表
	 */
	'children'	: {},

	/**
	 * @检查进程数的定时器
	 */
	'timer'		: null,
}

/**
 * @注册子进程映射表
 */
Master.register	= function (name, path, cnum) {
	Master.bindings[name]	= {
		'path'	: path,
		'cnum'	: intval(cnum, 1),
	};
};

/**
 * @请求分发
 */
Master.dispatch = function () {

	/**
	 * @检查进程数
	 */
	Master.timer	= setInterval(Master.mainloop, 100);

	/**
	 * @忽略HUP信号
	 */
	process.on('SIGHUP',  function () {});
	
	/**
	 * @TERM信号，优雅退出
	 */
	process.on('SIGTERM', function () {
		console.log('[Master] Got SIGTERM signal.');
		Master.shutdown	= true;
		if (Master.timer) {
			clearInterval(Master.timer);
			Master.timer	= null;
		}
		Master.killall();
	});

	/**
	 * @USR1信号，重启所有子进程
	 */
	process.on('SIGUSR1', function () {
		//
	});
};

/**
 * @检查子进程数量
 */
Master.mainloop	= function () {
	for (var name in Master.bindings) {
		var cnt	= 0;
		var cfg	= Master.bindings[name];
		var has	= Master.children[name] ? Master.children[name] : {};
		for (var pid in has) {
			var sub	= has[pid] ? has[pid] : {};
			if (CSTATUS.PEDDING == sub.status || CSTATUS.RUNNING == sub.status) {
				cnt++;
			}
		}

		cnt < 1 && isport(name) && Master.listen(name);
		while (cnt < cfg.cnum) {
			Master.startup(cfg.path, name);
			cnt++;
		}
	}
};

/**
 * @启动子进程
 */
Master.startup = function (path, name) {
	var sub	= Child.fork(path);
	var pid	= sub.pid;

	if (!Master.children[name]) {
		Master.children[name]	= {};
	}

	Master.children[name][pid]	= {
		'uptime'	: timestamp(),
		'scores'	: 0,
		'remain'	: 5,		/**<	避免大量请求瞬间涌入 */
		'status'	: CSTATUS.PEDDING,
		'process'	: sub,
	};

	sub.on('message', function (msg) {
		Master.doMessage(msg, name, pid);
	});
	sub.on('exit', function (code, signal) {
		try {
			delete Master.children[name][pid];
		} catch (e) {}

		if (Master.shutdown && !Master.children) {
			process.exit(0);
		}
	});
};

/**
 * @监听端口
 */
Master.listen = function (port) {
	var server	= new TCP();
	server.bind('0.0.0.0', port);
	server.onconnection	= function (handle) {
		var pid	= Master.select(port);
		if (!pid) {
			// TODO: output
		} else {
			var sub	= Master.children[port][pid];

			sub.scores++;
			sub.remain++;
			sub.process.send({
				'type'	: MESSAGE.REQ_FD,
			}, handle);
		}

		handle.close();
	}
	server.listen('/dev/null');
};

/**
 * @选择一个子进程
 */
Master.select	= function (port) {
	var pid	= 0;
	var max	= 4294967296;

	if (!Master.children[port]) {
		return;
	}

	for (var idx in Master.children[port]) {
		var sub	= Master.children[port][idx];
		if (max > sub.remain && CSTATUS.RUNNING == sub.status) {
			pid	= idx;
			max	= sub.remain;
		}
	}

	return pid;
};

/**
 * @杀掉所有子进程
 */
Master.killall	= function () {
	for (var port in Master.children) {
		for (var pid in Master.children[port]) {
			Master.children[port][pid].process.kill('SIGTERM');
		}
	}
};

/**
 * @子进程发送的消息
 */
Master.doMessage = function (msg, port, pid) {
	if (!msg.type || !msg.data) {
		return;
	}

	switch (msg.type) {
		case MESSAGE.HEART:
			for (var key in msg.data) {
				Master.children[port][pid][key]	= msg.data[key];
			}
			break;

		case MESSAGE.RELOAD:
			break;

		default:
			break;
	}
};

var Worker	= {

	/**
	 * @退出标记
	 */
	'shutdown'	: false,

	/**
	 * @未处理请求个数
	 */
	'remain'	: 0,

	/**
	 * @进程状态
	 */
	'status'	: CSTATUS.PEDDING,
};

Worker.ready	= function (callback) {

	Worker.status	= CSTATUS.RUNNING;
	Worker.remain	= 0;

	/**
	 * @报告心跳
	 */
	process.hasOwnProperty('send') && setInterval(function () {
		process.send({
			'type'	: MESSAGE.HEART,
			'data'	: {
				'status'	: Worker.status,
				'remain'	: Worker.remain,
				'memory'	: process.memoryUsage(),
			},
		});
	}, 1000);

	/**
	 * @处理FD
	 */
	process.on('message', function (msg, handle) {
		if (!msg.type || MESSAGE.REQ_FD != msg.type || !handle) {
			return;
		}

		Worker.remain++;
		if (!callback) {
			handle.close();
			return;
		}

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
		Worker.shutdown	= true;
	});
};

/**
 * @请求结束，释放remain资源
 */
Worker.release	= function () {
	Worker.remain--;
	if (Worker.remain < 1 && Worker.shutdown) {
		process.exit(0);
	}
};

exports.create	= function (isMaster) {
	if (isMaster) {
		return {
			'register'	: Master.register,
			'dispatch'	: Master.dispatch,
		};
	} else {
		return {
			'ready'		: Worker.ready,
			'release'	: Worker.release,
		};
	}
};

