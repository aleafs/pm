[![Build Status](https://secure.travis-ci.org/aleafs/pm.png?branch=master)](http://travis-ci.org/aleafs/pm)

## About

`pm` 是一个轻量级的Node.js多进程管理器，基于之前的`node-cluster`重构而来，在淘宝内部的生产系统中得到了广泛的应用.

* 基于 master + worker 模式，master负责进程管理，worker 处理业务逻辑，有效利用现代服务器的多CPU;
* 同一 master 可管理多种类型的worker, 并且支持在不同类型的 worker 之间进行轻量的消息传递;
* 同一类型的 worker ，在 master 中进行负载均衡和健康检查，尤其对于类似死循环导致的“假死”情况有很好的识别;
* 平滑退出和 不退出前提下的 worker 进程重载 (reload).

## Install

```bash
$ npm install pm
```

## Usage

* in `master.js`, run as master:

```javascript
var app = require('pm').createMaster({
 'pidfile' : '/tmp/demo.pid',
});

app.register('group1', __dirname + '/http.js', {
 'listen' : [8080, 8081]
});

```

* in `http.js`, run as worker:

```javascript
var http = require('http').createServer(function (req, res) {
 res.end('hello world');
});

require('pm').createWorker().ready(function (socket, port) {
 http.emit('connection', socket);
});
```
* 在 `demo` 目录下你能看到更多的示例代码.

## Test

unit test

```bash
$ make test
```

jscoverage: [**92%**](http://fengmk2.github.com/coverage/node-cluster.html)

```bash
$ make cov
```

## Contributors

Thanks goes to the people who have contributed code to this module, see the [GitHub Contributors page](https://github.com/aleafs/pm/graphs/contributors).

Below is the output from `git-summary`

```
 project: pm
 commits: 239
 files  : 23
 authors: 
   199	aleafs                  83.3%
    23	fengmk2                 9.6%
     9	Jackson Tian            3.8%
     6	aleafs zhang            2.5%
     1	Will Wen Gunn           0.4%
     1	pengchun                0.4%

```

## License

`pm` is published under MIT license.
See license text in [LICENSE](https://github.com/aleafs/pm/blob/master/LICENSE) file.

