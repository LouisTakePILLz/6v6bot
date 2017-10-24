import * as constants from '~/constants'
import * as errors from '~/errors'
import * as utils from '~/utils'

export default function load(api) {
  const { registerCommand: register, permissions, guildSettings } = api

  permissions.registerPermission(constants.PERM_CHANNELS, 'Allows using all the commands related to channel configuration')

  register('setchannel', {
    desc: 'Sets the channel to use to control and administrate the 6v6 lobby',
    perm: `Requires \`${constants.PERM_CHANNELS}\``
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_CHANNELS)
    if (granted) {
      try {
        await guildSettings.addCommandChannel(message.guild.id, message.channel.id)
        message.channel.send('Command channel successfully set')
      } catch (err) {
        message.channel.send('An error occured while trying to set the command channel')
      }
    } else {
      message.channel.send('You don\'t have permission to set the command channel')
    }
  })

  register('setlobby', {
    desc: 'Sets the current voice channel as the lobby for regrouping players before and after games',
    perm: `Requires \`${constants.PERM_CHANNELS}\``
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_CHANNELS)
    if (granted) {
      try {
        const registered = await guildSettings.isCommandChannelRegistered(message.guild.id, message.channel.id)
        if (!registered) {
          message.channel.send(constants.MSG_CMD_CHANNEL_NOT_REGISTERED)
          return
        }
      } catch (err) {
        message.channel.send(constants.MSG_ERR_LOOKUP_CMDCHANNEL)
        return
      }

      const voiceChannel = utils.getUserVoiceChannel(bot, message.guild, message.author)
      if (voiceChannel == null) {
        message.channel.send('You must be connected to a voice channel to set the lobby voice channel')
        return
      }

      try {
        await guildSettings.setLobbyVoiceChannel(message.guild.id, message.channel.id, voiceChannel.id)
        message.channel.send('Lobby voice channel successfully set')
      } catch (err) {
        if (err instanceof errors.CommandChannelNotRegisteredError) {
          message.channel.send(constants.MSG_CMD_CHANNEL_NOT_REGISTERED)
          return
        }

        message.channel.send('An error occured while trying to set the lobby voice channel')
      }
    } else {
      message.channel.send('You don\'t have permission to set the lobby voice channel')
    }
  })

  register('setvoice', {
    desc: 'Sets the current voice channel as the voice channel for a specified team',
    perm: `Requires \`${constants.PERM_CHANNELS}\``,
    extra: 'setvoice team1|team2'
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_CHANNELS)
    if (granted) {
      const teamName = args[0]

      if (constants.TEAM_NAMES[teamName] == null) {
        message.channel.send(constants.MSG_INVALID_TEAM_NAME)
        return
      }

      try {
        const registered = await guildSettings.isCommandChannelRegistered(message.guild.id, message.channel.id)
        if (!registered) {
          message.channel.send(constants.MSG_CMD_CHANNEL_NOT_REGISTERED)
          return
        }
      } catch (err) {
        message.channel.send(constants.MSG_ERR_LOOKUP_CMDCHANNEL)
        return
      }

      const voiceChannel = utils.getUserVoiceChannel(bot, message.guild, message.author)
      if (voiceChannel == null) {
        message.channel.send(`You must be connected to a voice channel to set the voice channel for ${constants.TEAM_NAMES[teamName]}`)
        return
      }

      try {
        await guildSettings.setTeamVoiceChannel(message.guild.id, message.channel.id, voiceChannel.id, teamName)
        message.channel.send(`Team voice channel successfully set for ${constants.TEAM_NAMES[teamName]}`)
      } catch (err) {
        if (err instanceof errors.CommandChannelNotRegisteredError) {
          message.channel.send(constants.MSG_CMD_CHANNEL_NOT_REGISTERED)
          return
        }

        if (err instanceof errors.InvalidTeamNameError) {
          message.channel.send(constants.MSG_INVALID_TEAM_NAME)
          return
        }

        message.channel.send('An error occured while trying to set the lobby voice channel')
      }
    } else {
      message.channel.send('You don\'t have permission to set team voice channels')
    }
  })

  register('deletechannel', {
    desc: 'Unregisters the channel as a 6v6 command channel',
    perm: `Requires \`${constants.PERM_CHANNELS}\``
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_CHANNELS)
    if (granted) {
      try {
        await guildSettings.removeCommandChannel(message.guild.id, message.channel.id)
        message.channel.send('Command channel successfully deleted')
      } catch (err) {
        if (err instanceof errors.CommandChannelNotRegisteredError) {
          message.channel.send(constants.MSG_CMD_CHANNEL_NOT_REGISTERED)
          return
        }

        message.channel.send('An error occured while trying to delete the command channel')
      }
    } else {
      message.channel.send('You don\'t have permission to remove command channels')
    }
  })
}
