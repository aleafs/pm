TESTS = test/*.test.js
REPORTER = spec
TIMEOUT = 5000
JSCOVERAGE = ./node_modules/jscover/bin/jscover

install:
	@npm install

test: install
	@NODE_ENV=test ./node_modules/mocha/bin/mocha \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		$(TESTS)

cov: install
	@rm -rf ./lib-cov coverage.html
	@$(JSCOVERAGE) lib lib-cov
	@PM_COV=1 $(MAKE) test REPORTER=dot
	@PM_COV=1 $(MAKE) test REPORTER=html-cov > coverage.html
	
.PHONY: test
