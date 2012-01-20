/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Child	= require('child_process');

var Master	= function () {
	/**
	 * @已经启动的子进程列表
	 */
	var childrenlist	= {};

	/**
	 * @注册的监听分发列表
	 */
	var registerlist	= {};

}

Master.prototype.register	= function (port, path, cnum) {
	registerlist[port]	= {
		'path'	: path,
		'cnum'	: cnum,
	};
}

Master.prototype.dispatch	= function () {
}

exports.instance	= function () {
	return new Master(conf);
}
