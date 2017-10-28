import assert from 'assert'
import { MongoClient } from 'mongodb'
import Discord from 'discord.js'
import plugins from '~/plugins'
import * as utils from '~/utils'
import options from '~/options'
import PermissionManager from '~/PermissionManager'
import GuildSettingsManager from '~/GuildSettingsManager'
import GameSessionManager from '~/GameSessionManager'

require('dotenv').config()

const {
  DISCORD_TOKEN,
  MONGODB_CONNECTION
} = process.env

assert.ok(DISCORD_TOKEN, 'DISCORD_TOKEN env variable must be set')
assert.ok(MONGODB_CONNECTION, 'MONGODB_CONNECTION env variable must be set')

MongoClient.connect(MONGODB_CONNECTION, (err, db) => {
  assert.equal(null, err)

  db.collection('user_permissions').createIndex({ guildId: 1, userId: 1, node: 1 }, { unique: true, sparse: true })
  db.collection('role_permissions').createIndex({ guildId: 1, roleId: 1, node: 1 }, { unique: true, sparse: true })
  db.collection('guilds').createIndex({ guildId: 1 })

  const bot = new Discord.Client({
    forceFetchUsers: true
  })

  function* getCommand(content) {
    // TODO: add quote support
    const pattern = /(\S+)/g
    let match

    do {
      match = pattern.exec(content)
      if (match) {
        yield match[1]
      }
    } while (match)
  }

  const registeredCommands = new Map()
  const registeredListeners = []
  const permissions = new (PermissionManager({ db, bot }))()
  const guildSettings = new (GuildSettingsManager({ db, bot }))()
  const gameSessions = new (GameSessionManager({ db, bot, guildSettings }))()

  const PluginAPI = {
    db,
    bot,
    permissions,
    guildSettings,
    gameSessions,
    options,
    getCommands() {
      return registeredCommands
    },
    registerCommand(command, helpInfo, fn) {
      registeredCommands.set(command, {
        fn,
        helpInfo: typeof (helpInfo) === 'string' ? { desc: helpInfo } : helpInfo
      })
    },
    registerRaw(fn) {
      registeredListeners.push(fn)
    }
  }

  Array.forEach(plugins, plugin => plugin(PluginAPI))

  bot.on('message', (message) => {
    const mentionPattern = /^<@!?(\d+)> /g
    const matches = mentionPattern.exec(message.content)
    if (matches == null) {
      return
    }

    const [match, memberId] = matches
    if (memberId === bot.user.id) {
      const args = [...getCommand(message.content.substr(match.length))]
      const cmd = args.shift().toLowerCase().trim()
      const command = registeredCommands.get(cmd)

      if (command == null) {
        message.channel.send(`Unknown command: \`${utils.sanitizeCode(cmd)}\``)
        return
      }

      Array.forEach(registeredListeners, cb => setTimeout(() => cb(bot, message, cmd, args)))
      setTimeout(() => command.fn(bot, message, args))
    } else {
      Array.forEach(registeredListeners, cb => setTimeout(() => cb(bot, message, false)))
    }
  })

  bot.login(DISCORD_TOKEN)
})
