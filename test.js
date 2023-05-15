const BlockAnalyzer = require('./server/src/blockAnalyzer')

const blockAnalyzer = new BlockAnalyzer()

const out = blockAnalyzer.analyze(require('fs').readFileSync('./test_configuration.tf').toString())

require('fs').writeFileSync('./out.json', JSON.stringify(out))