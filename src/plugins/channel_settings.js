import * as constants from '~/constants'
import * as utils from '~/utils'

const TEAM_NAMES = {
  team1: 'Team 1',
  team2: 'Team 2'
}
const TEAM_NAMES_LIST = Object.keys(TEAM_NAMES).map(x => '`' + x + '`').join(', ')

const commands = (api) => ({

  setChannel(bot, message, args) {
    const { author } = message

    api.permissions.checkPermission(message, constants.PERM_CHANNELS)
      .then((granted) => {
        if (granted) {
          const query = { guildId: message.guild.id, setting: 'commandChannels' }

          api.db.collection('guilds').update(query, { $addToSet: { values: message.channel.id } }, { upsert: true }, (err, numAffected) => {
            if (err) {
              console.log('setChannel DB ERROR', err)

              message.channel.send('An error occured while trying to set the command channel')

              return
            }

            message.channel.send('Command channel successfully set', undefined, (err, confirmationMsg) => {
              if (err) {
                console.log('setChannel FAILED TO SEND SUCCESS MESSAGE')
                return
              }
            })
          })
        } else {
          message.channel.send('You don\'t have permission to set the command channel')
        }
      })
  },

  deleteChannel(bot, message, args) {
    const { author } = message

    api.permissions.checkPermission(message, constants.PERM_CHANNELS)
      .then((granted) => {
        if (granted) {
          const query = { guildId: message.guild.id, setting: 'commandChannels' }

          api.db.collection('guilds').update(query, { $pull: { values: message.channel.id } })
            .then((e) => {
              if (e.result.nModified === 0) {
                message.channel.send('This text channel is not a registered command channel')
                return false
              }
              else {
                const query = { guildId: message.guild.id, cmdChannelId: message.channel.id, setting: 'voiceChannel' }
                return api.db.collection('guilds').deleteMany(query)
              }
            }, /* onError*/ (err) => {
              console.log('deleteChannel DB ERROR 1', err)
              message.channel.send('An error occured while trying to delete the command channel')
            })
            .then((e) => {
              if (!e) {
                // Returning since the text channel couldn't be deleted
                return
              }
              message.channel.send('Command channel successfully deleted')
            }, /* onError*/ (err) => {
              console.log('deleteChannel DB ERROR 2', err)
              message.channel.send('An error occured while trying to delete the associated voice channels')
            })
        } else {
          message.channel.send('You don\'t have permission to remove command channels')
        }
      })
  },

  setLobby(bot, message, args) {
    const { author } = message

    api.permissions.checkPermission(message, constants.PERM_CHANNELS)
      .then((granted) => {
        if (granted) {
          const voiceChannel = utils.getUserVoiceChannel(bot, message.guild, message.author)

          const cmdChannelQuery = { guildId: message.guild.id, setting: 'commandChannels', values: { $all: [message.channel.id] } }

          api.db.collection('guilds').findOne(cmdChannelQuery, (err, doc) => {

            if (err) {
              console.log('setLobby DB ERROR 1', err)
              return
            }

            if (doc == null) {
              message.channel.send('This text channel is not a registered command channel')
              return
            }

            if (voiceChannel == null) {
              message.channel.send('You must be connected to a voice channel to set the lobby voice channel')
              return
            }


            const lobbyChannelQuery = { guildId: message.guild.id, cmdChannelId: message.channel.id, setting: 'lobbyChannel' }

            api.db.collection('guilds').update(lobbyChannelQuery, { $set: { value: voiceChannel.id } }, { upsert: true }, (err, numAffected) => {
              if (err) {
                console.log('setLobby DB ERROR 2', err)

                message.channel.send('An error occured while trying to set the lobby voice channel')

                return
              }

              message.channel.send('Lobby voice channel successfully set', undefined, (err) => {
                if (err) {
                  console.log('setLobby FAILED TO SEND SUCCESS MESSAGE')
                  return
                }
              })
            })

          })
        } else {
          message.channel.send('You don\'t have permission to set the lobby channel')
        }
      })
  },

  setVoice(bot, message, args) {
    const { author } = message

    api.permissions.checkPermission(message, constants.PERM_CHANNELS)
      .then((granted) => {
        if (granted) {
          const voiceChannel = utils.getUserVoiceChannel(bot, message.guild, message.author)

          const cmdChannelQuery = { guildId: message.guild.id, setting: 'commandChannels', values: { $all: [message.channel.id] } }

          api.db.collection('guilds').findOne(cmdChannelQuery, (err, doc) => {

            if (err) {
              console.log('setLobby DB ERROR 1', err)
              return
            }

            if (doc == null) {
              message.channel.send('This text channel is not a registered command channel')
              return
            }

            if (args.length === 0) {
              message.channel.send('You must specify the name of the team you want to set the voice channel for. Possible values: ' + TEAM_NAMES_LIST)
              return
            }

            const team = args[0]
            if (TEAM_NAMES[team] == null) {
              message.channel.send('The specified team name is invalid. Possible values: ' + TEAM_NAMES_LIST)
              return
            }

            if (voiceChannel == null) {
              message.channel.send('You must be connected to a voice channel to set the voice channel for ' + TEAM_NAMES[team])
              return
            }


            const voiceChannelQuery = { guildId: message.guild.id, cmdChannelId: message.channel.id, setting: 'voiceChannel', teamName: team }

            api.db.collection('guilds').update(voiceChannelQuery, { $set: { value: voiceChannel.id } }, { upsert: true }, (err, numAffected) => {
              if (err) {
                console.log('setVoice DB ERROR 2', err)

                message.channel.send('An error occured while trying to set the lobby voice channel')

                return
              }

              message.channel.send('Team voice channel successfully set for ' + TEAM_NAMES[team], undefined, (err) => {
                if (err) {
                  console.log('setVoice FAILED TO SEND SUCCESS MESSAGE')
                  return
                }
              })
            })

          })
        } else {
          message.channel.send('You don\'t have permission to set the lobby channel')
        }
      })
  }

})

export default function load(api) {
  const { registerCommand: register, permissions } = api
  const cmds = commands(api)

  permissions.registerPermission(constants.PERM_CHANNELS, 'Allows using all the commands related to channel configuration')

  register('setchannel', {
    desc: 'Sets the channel to use to control and administrate the 6v6 lobby',
    perm: `Requires \`${constants.PERM_CHANNELS}\``
  }, cmds.setChannel)

  register('setlobby', {
    desc: 'Sets the current voice channel as the lobby for regrouping players before and after games',
    perm: `Requires \`${constants.PERM_CHANNELS}\``
  }, cmds.setLobby)

  register('setvoice', {
    desc: 'Sets the current voice channel as the voice channel for a specified team',
    perm: `Requires \`${constants.PERM_CHANNELS}\``,
    extra: 'setvoice team1|team2'
  }, cmds.setVoice)

  register('deletechannel', {
    desc: 'Unregisters the channel as a 6v6 command channel',
    perm: `Requires \`${constants.PERM_CHANNELS}\``
  }, cmds.deleteChannel)
}
