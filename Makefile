TESTS = test/*.js
REPORTER = spec
TIMEOUT = 5000
JSCOVERAGE = ./node_modules/visionmedia-jscoverage/jscoverage
MOCHA = ./node_modules/mocha/bin/mocha

install:
	@npm install

test: install
	@NODE_ENV=test $(MOCHA) --reporter $(REPORTER) --timeout $(TIMEOUT) \
		$(MOCHA_OPTS) $(TESTS)

cov: clean
	@$(JSCOVERAGE) ./lib ./lib-cov
	@NODE_CLUSTER_COV=1 $(MAKE) test REPORTER=dot
	@NODE_CLUSTER_COV=1 $(MAKE) test REPORTER=html-cov > ./coverage.html

clean:
	@rm -rf ./coverage.html ./lib-cov

.PHONY: test clean install cov
