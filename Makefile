TESTS = test/*.test.js
REPORTER = spec
TIMEOUT = 5000
MOCHA_OPTS =

install:
	@npm install

test: install
	@NODE_ENV=test ./node_modules/mocha/bin/mocha \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		$(MOCHA_OPTS) \
		$(TESTS)

cov: install
	@NODE_ENV=test ./node_modules/.bin/istanbul cover \
		./node_modules/mocha/bin/_mocha -- -R spec
	
coveralls: install
	@NODE_ENV=test ./node_modules/.bin/istanbul cover \
		./node_modules/mocha/bin/_mocha --report lcovonly -- -R spec && \
		cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js --verbose
	
.PHONY: test
