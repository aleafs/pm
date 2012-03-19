SRC = $(shell find lib -type f -name "*.js")
TESTS = test/*.js
TESTTIMEOUT = 10000
VERSION = $(shell date +%Y%m%d%H%M%S)

test:
	@NODE_ENV=test ./node_modules/mocha/bin/mocha \
		--reporter spec --timeout $(TESTTIMEOUT) $(TESTS)

cov:
	@JSCOV=1 ./node_modules/mocha/bin/mocha \
		--reporter html-cov --timeout $(TESTTIMEOUT) $(TESTS) > coverage.html

.PHONY: test
