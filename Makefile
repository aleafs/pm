
JSCOVERAGE="./node_modules/visionmedia-jscoverage/jscoverage"

test:
	@npm install
	@./node_modules/mocha/bin/mocha --reporter spec --timeout 2000 test/*.test.js

cov: clean
	@npm install
	@mv lib lib.bak && $(JSCOVERAGE) lib.bak lib 
	-./node_modules/mocha/bin/mocha --reporter html-cov --timeout 2000 --ignore-leaks test/*.test.js > ./coverage.html
	-rm -rf lib && mv lib.bak lib

clean:
	-rm -rf ./coverage.html

.PHONY: test
