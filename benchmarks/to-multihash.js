const startIPFS = require('./utils/start-ipfs')
const releaseRepo = require('./utils/release-repo')
const Log = require('../src/log')

const base = {
  prepare: async function () {
    const { ipfs, repo } = await startIPFS('./ipfs-log-benchmarks/ipfs')
    this._repo = repo
    const log = new Log(ipfs, 'A')

    process.stdout.clearLine()
    for (let i = 1; i<this.count + 1; i++) {
      process.stdout.write(`\r${this.name} / Preparing / Writing: ${i}/${this.count}`)
      await log.append(`Hello World: ${i}`)
    }

    return log
  },
  cycle: async function (log) {
    await log.toMultihash()
  },
  teardown: async function () {
    await releaseRepo(this._repo)
  }
}

const baseline = {
  while: (stats, startTime) => {
    return stats.count < 1000
  }
}

const stress = {
  while: (stats, startTime) => {
    return process.hrtime(startTime)[0] < 300
  }
}

const counts = [1, 100, 1000, 10000]
let benchmarks = []
for (const count of counts) {
  const c = { count }
  benchmarks.push({ name: `toMultihash-${count}-baseline`, ...base, ...c, ...baseline })
  benchmarks.push({ name: `toMultihash-${count}-stress`, ...base, ...c, ...stress })
}

module.exports = benchmarks
