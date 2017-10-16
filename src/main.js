import path from 'path'
import fs from 'fs'
import assert from 'assert'
import { MongoClient } from 'mongodb'
import Datastore from 'nedb'
import Discord from 'discord.js'
import request from 'superagent'
import plugins from '~/plugins'
import * as utils from '~/utils'
import options from '~/options'
import PermissionManager from '~/PermissionManager'

require('dotenv').config()
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const MONGODB_CONNECTION = process.env.MONGODB_CONNECTION

assert.ok(DISCORD_TOKEN, 'DISCORD_TOKEN env variable must be set')
assert.ok(MONGODB_CONNECTION, 'MONGODB_CONNECTION env variable must be set')

MongoClient.connect(MONGODB_CONNECTION, (err, db) => {
  assert.equal(null, err)

  db.collection('permissions').createIndex({ serverId: 1, userId: 1, node: 1 }, { unique: true })
  db.collection('servers').createIndex({ serverId: 1 })

  const bot = new Discord.Client({
    forceFetchUsers: true
  })

  function* getCommand(content) {
    const pattern = /(\S+)/g
    let match

    do {
      match = pattern.exec(content)
      if (match) {
        yield match[1]
      }
    } while (match)
  }

  const registeredCommands = {}
  const registeredListeners = []
  const permissions = PermissionManager(db, bot)

  const PluginAPI = {
    db,
    bot,
    permissions,
    options,
    registerCommand(command, helpText, fn) {
      registeredCommands[command] = registeredCommands[command] || []
      registeredCommands[command].push({
        fn,
        helpText
      })
    },
    registerRaw(fn) {
      registeredListeners.push(fn)
    }
  }

  Array.forEach(plugins, plugin => {
    plugin(PluginAPI)
  })

  bot.on('message', message => {
    Array.forEach(registeredListeners, (cb) => setTimeout(() => cb(bot, message)))

    if (message.content.indexOf('!') === 0) {
      const args = [...getCommand(message.content.substr(1))]
      const cmd = args.shift().toLowerCase().trim()
      const command = registeredCommands[cmd]
      console.log(message.author.id)

      if (!command || !command.length) {
        bot.reply(message, `Unknown command: \`${utils.sanitizeCode(cmd)}\``)
        return
      }

      Array.forEach(command, (cmd) => setTimeout(() => cmd.fn(bot, message, args)))
    }
  })

  bot.loginWithToken(DISCORD_TOKEN)
})

/*const db = {
  permissions: new Datastore({ filename: 'db/permissions.db', autoload: true }),
  servers: new Datastore({ filename: 'db/servers.db', autoload: true })
}

db.permissions.ensureIndex({ fieldName: 'serverId' })
db.permissions.ensureIndex({ fieldName: 'userId', unique: true })

db.servers.ensureIndex({ fieldName: 'serverId' })*/
