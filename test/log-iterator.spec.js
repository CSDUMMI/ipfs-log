'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const fs = require('fs-extra')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')
const Keystore = require('orbit-db-keystore')
const LogCreator = require('./utils/log-creator')

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('orbit-db-test-utils')

let ipfs, testIdentity, testIdentity2, testIdentity3

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Iterator (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, {
      repo: config.defaultIpfsConfig.repo + '-log-join' + new Date().getTime()
    })

    let keystore, signingKeystore

    before(async () => {
      rmrf.sync(ipfsConfig.repo)
      rmrf.sync(identityKeysPath)
      rmrf.sync(signingKeysPath)
      await fs.copy(identityKeyFixtures, identityKeysPath)
      await fs.copy(signingKeyFixtures, signingKeysPath)

      keystore = new Keystore(identityKeysPath)
      signingKeystore = new Keystore(signingKeysPath)

      testIdentity = await IdentityProvider.createIdentity({ id: 'userA', keystore, signingKeystore })
      testIdentity2 = await IdentityProvider.createIdentity({ id: 'userB', keystore, signingKeystore })
      testIdentity3 = await IdentityProvider.createIdentity({ id: 'userC', keystore, signingKeystore })
      ipfs = await startIpfs(IPFS, ipfsConfig)
    })

    after(async () => {
      await stopIpfs(ipfs)
      rmrf.sync(ipfsConfig.repo)
      rmrf.sync(identityKeysPath)
      rmrf.sync(signingKeysPath)

      await keystore.close()
      await signingKeystore.close()
    })

    describe('Basic iterator functionality', () => {
      let log1

      beforeEach(async () => {
        log1 = new Log(ipfs, testIdentity, { logId: 'X' })

        for (let i = 0; i <= 100; i++) {
          await log1.append('entry' + i)
        }
      })

      it('returns a Symbol.iterator object', async () => {
        let it = log1.iterator({
          lte: 'zdpuAwHMV58rXXxRy3gFv8HQin7QasDTy9yMBgzQUFSFP2Ter',
          amount: 0
        })

        assert.strictEqual(typeof it[Symbol.iterator], 'function')
        assert.deepStrictEqual(it.next(), { value: undefined, done: true })
      })

      it('returns length with lte and amount', async () => {
        let amount = 10
        let it = log1.iterator({
          lte: 'zdpuAwHMV58rXXxRy3gFv8HQin7QasDTy9yMBgzQUFSFP2Ter',
          amount: amount
        })

        assert.strictEqual([...it].length, 10)
      })

      it('returns entries with lte and amount', async () => {
        let amount = 10

        let it = log1.iterator({
          lte: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34',
          amount: amount
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (67 - i++))
        }
      })

      it('returns length with lt and amount', async () => {
        let amount = 10

        let it = log1.iterator({
          lt: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34',
          amount: amount
        })

        assert.strictEqual([...it].length, amount)
      })

      it('returns entries with lt and amount', async () => {
        let amount = 10

        let it = log1.iterator({
          lt: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34',
          amount: amount
        })

        let i = 1
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (67 - i++))
        }
      })

      it('returns correct length with gt and amount', async () => {
        let amount = 5
        let it = log1.iterator({
          gt: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34',
          amount: amount
        })

        let i = 0
        let count = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (72 - i++))
          count++
        }
        assert.strictEqual(count, amount)
      })

      it('returns length with gte and amount', async () => {
        let amount = 12

        let it = log1.iterator({
          gt: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34',
          amount: amount
        })

        assert.strictEqual([...it].length, amount)
      })

      it('returns entries with gte and amount', async () => {
        let amount = 12

        let it = log1.iterator({
          gt: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34',
          amount: amount
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (79 - i++))
        }
      })

      /* eslint-disable camelcase */
      it('iterates with lt and gt', async () => {
        let it = log1.iterator({
          gt: 'zdpuAyLvGXAtuvXXpWMKQFQC7zTKUae9f4UT9gKdBt7hgj7vP',
          lt: 'zdpuAw6wDetY5ZrF5FyGkfyVpUBSdxN97CY6TpubrnTAbETwX'
        })
        let hashes = [...it].map(e => e.hash)

        // neither hash should appear in the array
        assert.strictEqual(hashes.indexOf('zdpuAyLvGXAtuvXXpWMKQFQC7zTKUae9f4UT9gKdBt7hgj7vP'), -1)
        assert.strictEqual(hashes.indexOf('zdpuAw6wDetY5ZrF5FyGkfyVpUBSdxN97CY6TpubrnTAbETwX'), -1)
        assert.strictEqual(hashes.length, 10)
      })

      it('iterates with lt and gte', async () => {
        let it = log1.iterator({
          gte: 'zdpuAtkCJ8KT7R5TqZr2S6q1rLUDmp5KTpQoW9k5Ld6A3pYRW',
          lt: 'zdpuAvHo1Zjd2vruKAKddNNkUmkVWXJNGeahJYZ4QrfVLkgiU'
        })
        let hashes = [...it].map(e => e.hash)

        // only the gte hash should appear in the array
        assert.strictEqual(hashes.indexOf('zdpuAtkCJ8KT7R5TqZr2S6q1rLUDmp5KTpQoW9k5Ld6A3pYRW'), 24)
        assert.strictEqual(hashes.indexOf('zdpuAvHo1Zjd2vruKAKddNNkUmkVWXJNGeahJYZ4QrfVLkgiU'), -1)
        assert.strictEqual(hashes.length, 25)
      })

      it('iterates with lte and gt', async () => {
        let it = log1.iterator({
          gt: 'zdpuArLy1pt5H6KUmfgrdV1bLgXdQiwhJs4DjM9eUKQ4JfvC6',
          lte: 'zdpuAwHMV58rXXxRy3gFv8HQin7QasDTy9yMBgzQUFSFP2Ter'
        })
        let hashes = [...it].map(e => e.hash)

        // only the lte hash should appear in the array
        assert.strictEqual(hashes.indexOf('zdpuArLy1pt5H6KUmfgrdV1bLgXdQiwhJs4DjM9eUKQ4JfvC6'), -1)
        assert.strictEqual(hashes.indexOf('zdpuAwHMV58rXXxRy3gFv8HQin7QasDTy9yMBgzQUFSFP2Ter'), 0)
        assert.strictEqual(hashes.length, 4)
      })

      it('iterates with lte and gte', async () => {
        let it = log1.iterator({
          gte: 'zdpuArnrJ3XqAV3JqjhxNRAjQJt8NfdtYJc7YXqNqeBkAbYa1',
          lte: 'zdpuAqYy3c2teNsi93Pqv8c6dz6yfp3fshNpEREszpMdUVkvs'
        })
        let hashes = [...it].map(e => e.hash)

        // neither hash should appear in the array
        assert.strictEqual(hashes.indexOf('zdpuArnrJ3XqAV3JqjhxNRAjQJt8NfdtYJc7YXqNqeBkAbYa1'), 9)
        assert.strictEqual(hashes.indexOf('zdpuAqYy3c2teNsi93Pqv8c6dz6yfp3fshNpEREszpMdUVkvs'), 0)
        assert.strictEqual(hashes.length, 10)
      })

      it('returns length with gt and default amount', async () => {
        let it = log1.iterator({
          gt: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34'
        })

        assert.strictEqual([...it].length, 33)
      })

      it('returns entries with gt and default amount', async () => {
        let it = log1.iterator({
          gt: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34'
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (100 - i++))
        }
      })

      it('returns length with gte and default amount', async () => {
        let it = log1.iterator({
          gte: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34'
        })

        assert.strictEqual([...it].length, 34)
      })

      it('returns entries with gte and default amount', async () => {
        let it = log1.iterator({
          gte: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34'
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (100 - i++))
        }
      })

      it('returns length with lt and default amount value', async () => {
        let it = log1.iterator({
          lt: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34'
        })

        assert.strictEqual([...it].length, 67)
      })

      it('returns entries with lt and default amount value', async () => {
        let it = log1.iterator({
          lt: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34'
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (66 - i++))
        }
      })

      it('returns length with lte and default amount value', async () => {
        let it = log1.iterator({
          lte: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34'
        })

        assert.strictEqual([...it].length, 68)
      })

      it('returns entries with lte and default amount value', async () => {
        let it = log1.iterator({
          lte: 'zdpuAuGHqwAtYW5VHxQk7dkV1KYzXwUr2DayVquEZsHmw3E34'
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (67 - i++))
        }
      })
    })

    describe('Iteration over forked/joined logs', () => {
      let fixture, identities

      before(async () => {
        identities = [testIdentity3, testIdentity2, testIdentity3, testIdentity]
        fixture = await LogCreator.createLogWithSixteenEntries(Log, ipfs, identities)
      })

      it('returns the full length from all heads', async () => {
        let it = fixture.log.iterator({
          lte: fixture.log.heads
        })

        assert.strictEqual([...it].length, 16)
      })

      it('returns partial entries from all heads', async () => {
        let it = fixture.log.iterator({
          lte: fixture.log.heads,
          amount: 6
        })

        assert.deepStrictEqual([...it].map(e => e.payload),
          ['entryA10', 'entryA9', 'entryA8', 'entryA7', 'entryC0', 'entryA6'])
      })

      it('returns partial logs from single heads #1', async () => {
        let it = fixture.log.iterator({
          lte: [fixture.log.heads[0]]
        })

        assert.strictEqual([...it].length, 10)
      })

      it('returns partial logs from single heads #2', async () => {
        let it = fixture.log.iterator({
          lte: [fixture.log.heads[1]]
        })

        assert.strictEqual([...it].length, 11)
      })

      it('throws error if lt/lte not a string or array of entries', async () => {
        let errMsg

        try {
          fixture.log.iterator({
            lte: fixture.log.heads[1]
          })
        } catch (e) {
          errMsg = e.message
        }

        assert.strictEqual(errMsg, 'lt or lte must be a string or array of Entries')
      })
    })
  })
})
