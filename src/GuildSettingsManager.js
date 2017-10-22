import * as constants from '~/constants'
import * as errors from '~/errors'

const GuildSettingsManager = (env) => class GuildSettingsManager {
  addCommandChannel(guildId, channelId) {
    return new Promise((resolve, reject) => {
      const query = { guildId, setting: 'commandChannels' }

      env.db.collection('guilds')
        .update(query, { $addToSet: { values: channelId } }, { upsert: true })
        .then(({result}) => {
          const didInsertChannel = result.nModified !== 0
          resolve(didInsertChannel)
        }, (err) => {
          console.log('addCommandChannel DB ERROR', err)

          reject(new errors.DbError(err))
        })
    })
  }

  removeCommandChannel(guildId, cmdChannelId) {
    return new Promise((resolve, reject) => {
      const query = { guildId, setting: 'commandChannels' }

      env.db.collection('guilds')
        .update(query, { $pull: { values: cmdChannelId } })
        .then(({result}) => {
          if (result.nModified === 0) {
            reject(new errors.CommandChannelNotRegisteredError())
            return
          }

          const query = { guildId, cmdChannelId, setting: { $in: ['lobbyChannel', 'voiceChannel'] } }

          env.db.collection('guilds')
            .deleteMany(query)
            .then(() => {
              resolve()
            }, (err) => {
              console.log('removeCommandChannel DB ERROR 2', err)
              // Normally, we'd reject the promise... but we can't since MongoDB doesn't support transactions
              // so we just pretend everything went as expected (sorry about that D:)
              //reject(false)
              resolve()
            })
        }, /* onError*/ (err) => {
          console.log('removeCommandChannel DB ERROR 1', err)
          reject()
        })
    })
  }

  getCommandChannels(guildId) {
    // TODO: add caching
    return new Promise((resolve, reject) => {
      const query = { guildId: guildId, setting: 'commandChannels' }

      env.db.collection('guilds')
        .findOne(query)
        .thenOne((doc) => {
          // resolve(null) if no doc is returned
          resolve(doc || doc.values)
        }, (err) => {
          console.log('getCommandChannels DB ERROR', err)

          reject(new errors.DbError(err))
        })
    })
  }

  isCommandChannelRegistered(guildId, channelId) {
    // TODO: add caching
    return new Promise((resolve, reject) => {
      const query = { guildId: guildId, setting: 'commandChannels', values: { $all: [channelId] } }

      env.db.collection('guilds')
        .findOne(query)
        .then((doc) => {
          // resolve(BOOLEAN)
          resolve(!!doc)
        }, (err) => {
          console.log('isCommandChannelRegistered DB ERROR', err)

          reject(new errors.DbError(err))
        })
    })
  }

  setLobbyVoiceChannel(guildId, cmdChannelId, voiceChannelId) {
    return new Promise((resolve, reject) => {
      this.isCommandChannelRegistered(guildId, cmdChannelId)
        .then((registered) => {
          if (!registered) {
            reject(new errors.CommandChannelNotRegisteredError())
            return
          }

          const lobbyChannelQuery = { guildId, cmdChannelId, setting: 'lobbyChannel' }

          env.db.collection('guilds')
            .update(lobbyChannelQuery, { $set: { value: voiceChannelId } }, { upsert: true })
            .then(({result}) => {
              resolve()
            }, (err) => {
              console.log('setLobbyVoiceChannel DB ERROR 2', err)
              reject(new errors.DbError(err))
            })
        }, (err) => {
          console.log('setLobbyVoiceChannel DB ERROR 1', err)
          reject(new errors.DbError(err))
        })
    })
  }

  setTeamVoiceChannel(guildId, cmdChannelId, voiceChannelId, teamName) {
    return new Promise((resolve, reject) => {
      this.isCommandChannelRegistered(guildId, cmdChannelId)
        .then((registered) => {
          if (!registered) {
            reject(new errors.CommandChannelNotRegisteredError())
            return
          }

          if (constants.TEAM_NAMES[teamName] == null) {
            reject(new errors.InvalidTeamNameError(teamName))
          }

          const voiceChannelQuery = { guildId, cmdChannelId, setting: 'voiceChannel', teamName }

          env.db.collection('guilds')
            .update(voiceChannelQuery, { $set: { value: voiceChannelId } }, { upsert: true })
            .then(({result}) => {
              resolve()
            }, (err) => {
              console.log('setTeamVoiceChannel DB ERROR 2', err)
              reject(new errors.DbError(err))
            })
        }, (err) => {
          console.log('setTeamVoiceChannel DB ERROR 1', err)
          reject(new errors.DbError(err))
        })
    })
  }

  async getVoiceChannel(guildId, cmdChannelId, channelSetting) {
    let settingQuery

    if (channelSetting == 'lobby') {
      settingQuery = { setting: 'lobbyChannel' }
    } else if (channelSetting == 'team1') {
      settingQuery = { setting: 'voiceChannel', teamName: 'team1' }
    } else if (channelSetting == 'team2') {
      settingQuery = { setting: 'voiceChannel', teamName: 'team2' }
    } else {
      throw new Error('Invalid channel setting')
    }

    const registered = await this.isCommandChannelRegistered(guildId, cmdChannelId)
    if (!registered) {
      throw new errors.CommandChannelNotRegisteredError()
    }

    const channelQuery = { guildId, cmdChannelId, ...settingQuery }

    let doc

    try {
      doc = await env.db.collection('guilds').findOne(channelQuery)
    } catch (err) {
      throw new errors.DbError(err)
    }

    if (doc == null) {
      throw new errors.ChannelConfigurationError(channelSetting, `${channelSetting} is not set`)
    }

    return doc.value
  }

}

export default GuildSettingsManager
