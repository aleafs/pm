SRC = $(shell find lib -type f -name "*.js")
TESTS = test/*.js
TESTTIMEOUT = 10000
REPORTER = spec
VERSION = $(shell date +%Y%m%d%H%M%S)

test:
	@NODE_ENV=test ./node_modules/mocha/bin/mocha \
		--reporter $(REPORTER) --timeout $(TESTTIMEOUT) $(TESTS)

.PHONY: test
