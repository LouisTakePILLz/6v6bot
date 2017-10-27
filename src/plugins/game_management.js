import * as constants from '~/constants'
import * as errors from '~/errors'
import * as utils from '~/utils'
import defaultGameRules from '~/gameRules'
import { RichEmbed } from 'discord.js'

const GAMERULES_PER_PAGE = 5

const MSG_NO_GAME_SESSION = 'No on-going game session, use the `setup` command to initialize the game session'

function displayTeams(env, channel, textMessage) {
  const formatUserEntry = (member) => {
    const entry = `**${member.displayName}**`
    return utils.sanitizeCode(entry)
  }

  const getMemberList = (teamName) => {
    let list = '*Empty*'
    if (env.session.teams[teamName].leader != null) {
      list = formatUserEntry(env.session.teams[teamName].leader) + '\u{1F451}'
    }

    const members = [...env.session.teams[teamName].members.values()]
    if (members.length > 0) {
      list += '\n' + members.map(formatUserEntry).join('\n')
    }

    return list
  }

  const embed = new RichEmbed()
    // TODO: customizable team names?
    .setTitle('__6v6 Session - Team 1 vs. Team 2__')
    .setDescription('Drafted Teams')
    .setColor(0xA94AE8)
    .setTimestamp()
    .setFooter('Team drafts', 'https://cdn.discordapp.com/embed/avatars/0.png')
    .addField('__**Team 1**__', getMemberList('team1'), true)
    .addField('__**Team 2**__', getMemberList('team2'), true)

  if (textMessage != null) {
    channel.send(textMessage, { embed })
  } else {
    channel.send({ embed })
  }
}

export default function load(api) {
  const {
    registerCommand: register,
    permissions,
    guildSettings,
    gameSessions,
  } = api

  permissions.registerPermission(constants.PERM_ADMIN, 'Allows administrating game sessions')
  permissions.registerPermission(constants.PERM_SETUP, 'Allows setting up game sessions')
  permissions.registerPermission(constants.PERM_SETLEADER, 'Allows setting team leaders')

  /*api.bot.on('voiceStateUpdate', (oldMember, newMember) => {
    // TODO: automatically move new players to their team channels
    gameSessions.getGameSessionByLobby(newMember.voiceChannel)
  })*/

  register('gamerule', {
    desc: 'Manages game rules',
    perm: `Requires \`${constants.PERM_GAMERULE}\` or \`${constants.PERM_ADMIN}\``,
    extra: `**gamerule list** [<page>]
**gamerule set** <rule> <value>
**gamerule enable|disable** <rule>
**gamerule show** <rule>
`
  }, async (bot, message, args) => {
    const action = args[0]

    const granted = await permissions.checkPermission(message, constants.PERM_GAMERULE).or(constants.PERM_ADMIN)
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

      const session = gameSessions.getGameSession(message.guild, message.channel)

      if (action === 'list') {
        const gameRulesKeys = Object.keys(defaultGameRules)

        const embed = new RichEmbed()
          .setTitle('6v6 - Game Rules')
          .setColor(0xA94AE8)
          .setTimestamp()

        const maxPage = Math.ceil(Math.max(gameRulesKeys.length / GAMERULES_PER_PAGE, 1))
        const page = Math.max(Math.min(Number(args[1]) || 1, maxPage), 1)

        embed.setFooter(`Page ${page} of ${maxPage}`, 'https://cdn.discordapp.com/embed/avatars/0.png')

        const lastGameRule = Math.min(page * GAMERULES_PER_PAGE, gameRulesKeys.length)
        for (let i = (page - 1) * GAMERULES_PER_PAGE; i < lastGameRule; i++) {
          const gameRuleName = gameRulesKeys[i]
          const gameRule = defaultGameRules[gameRuleName]
          embed.addField('`' + gameRuleName + '`', gameRule.helpText, false)
        }

        message.channel.send({ embed })
        return
      }

      if (session.initialized) {
        message.channel.send('Unable to change game rules during setup or during an on-going game session')
        return
      }

      if (action === 'set') {
        // TODO
      } else if (action === 'enable') {
        // TODO
      } else if (action === 'disable') {
        // TODO
      } else if (action === 'show') {
        // TODO
      } else {
        message.channel.send('Invalid action name, check `help gamerule` for the usage information')
      }
    } else {
      message.channel.send('You don\'t have permission to change the game rules')
    }
  })

  register('setleader', {
    desc: 'Sets the team leader for a specified team',
    perm: `Requires \`${constants.PERM_SETLEADER}\` or \`${constants.PERM_ADMIN}\``,
    extra: '**setleader** <flake_id>|random team1|team2'
  }, async (bot, message, args) => {
    const mention = args[0]
    const teamName = args[1]

    const granted = await permissions.checkPermission(message, constants.PERM_SETLEADER).or(constants.PERM_ADMIN)
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

      const session = gameSessions.getGameSession(message.guild, message.channel)
      if (!session.initialized) {
        message.channel.send(MSG_NO_GAME_SESSION)
        return
      }

      let targetMember
      let msg

      if (mention === 'random') {
        if (session.started) {
          message.channel.send('You can\'t reroll team leaders when the game session has already started')
          return
        }

        const lobbyVoiceChannel = utils.resolveVoiceChannel(
          message.guild,
          await guildSettings.getVoiceChannelId(message.guild.id, message.channel.id, 'lobby')
        )
        const memberPool = [...lobbyVoiceChannel.members.values()]

        const teamLeader = session.teams[teamName].leader
        const teamLeaderIndex = memberPool.findIndex(x => x.id === teamLeader.id)
        if (teamLeaderIndex != null) {
          memberPool.splice(teamLeaderIndex, 1)
        }

        const enemyTeam = teamName === 'team1' ? 'team2' : 'team1'
        const enemyLeader = session.teams[enemyTeam].leader
        const enemyLeaderIndex = memberPool.findIndex(x => x.id === enemyLeader.id)
        if (enemyLeaderIndex != null) {
          memberPool.splice(enemyLeaderIndex, 1)
        }

        if (memberPool.length === 0) {
          message.channel.send(constants.MSG_NOT_ENOUGH_PLAYERS_RANDOM_LEADER)
          return
        }

        const randomMember = memberPool[Math.floor(Math.random() * memberPool.length)]

        if (session.teams.team1.members.delete(randomMember.id)) {
          msg = `${targetMember} has been removed from ${constants.TEAM_NAMES.team1} and set as the team leader for ${constants.TEAM_NAMES[teamName]}`
        } else if (session.teams.team2.members.delete(randomMember.id)) {
          msg = `${targetMember} has been removed from ${constants.TEAM_NAMES.team2} and set as the team leader for ${constants.TEAM_NAMES[teamName]}`
        }

        targetMember = randomMember
      } else {
        targetMember = utils.resolveMember(message.guild, mention)

        if (targetMember == null) {
          message.channel.send(constants.MSG_INVALID_TARGET_MEMBER)
          return
        }
      }

      if (constants.TEAM_NAMES[teamName] == null) {
        message.channel.send(constants.MSG_INVALID_TEAM_NAME)
        return
      }

      session.teams[teamName].leader = targetMember

      message.channel.send(msg || `${targetMember} has been set as the team leader for ${constants.TEAM_NAMES[teamName]}`)
    } else {
      message.channel.send('You don\'t have permission to set team leaders')
    }
  })

  register('unpick', {
    desc: 'Removes the target user from the team',
    perm: `Only works if used by a team leader. Team picks can be forced with the \`${constants.PERM_ADMIN}\` permission`,
    extra: '**unpick** <flake_id>'
  }, async (bot, message, args) => {
    const mention = args[0]
    const session = gameSessions.getGameSession(message.guild, message.channel)

    if (!session.initialized) {
      message.channel.send(MSG_NO_GAME_SESSION)
      return
    }

    const team1Leader = session.teams.team1.leader || {}
    const team2Leader = session.teams.team2.leader || {}

    const targetMember = utils.resolveMember(message.guild, mention)

    if (targetMember == null) {
      message.channel.send(constants.MSG_INVALID_TARGET_MEMBER)
      return
    }

    let targetTeam
    if (session.teams.team1.members.has(targetMember.id)) {
      targetTeam = 'team1'
    } else if (session.teams.team2.members.has(targetMember.id)) {
      targetTeam = 'team2'
    }

    const adminGranted = await permissions.checkPermission(message, constants.PERM_ADMIN)
    if (!adminGranted &&
      (
        (targetTeam === 'team1' && message.member.id !== team1Leader.id) ||
        (targetTeam === 'team2' && message.member.id !== team2Leader.id)
      )
    ) {
      message.channel.send(`Can't remove ${targetMember} from the team, as you are not the team leader`)
      return
    }

    if (targetTeam == null) {
      message.channel.send(`${targetMember} is not on a team`)
      return
    }

    if (team1Leader.id === targetMember.id || team2Leader.id === targetMember.id) {
      message.channel.send('You can\'t unpick a team leader')
      return
    }

    try {
      await session.removeFromTeam(targetTeam, targetMember)
      const msg = `${targetMember} was removed from ${constants.TEAM_NAMES[targetTeam]}\n`
                + `It's ${session.teams[session.getTurn()].leader}'s turn to pick`

      message.channel.send(msg)
    } catch (err) {
      if (err instanceof errors.InvalidTeamMemberError) {
        message.channel.send(`${targetMember} is not on a team`)
        return
      }

      console.log('unpick player ERROR', err)
      message.channel.send('An error occured while trying to remove a user from a team')
    }
  })

  register('pick', {
    desc: 'Adds the target user to the team',
    perm: `Only works if used by a team leader. Team picks can be forced with the \`${constants.PERM_ADMIN}\` permission`,
    extra: '**pick** <flake_id> [team1|team2]'
  }, async (bot, message, args) => {
    const mention = args[0]
    const teamName = args[1]
    const session = gameSessions.getGameSession(message.guild, message.channel)

    if (!session.initialized) {
      message.channel.send(MSG_NO_GAME_SESSION)
      return
    }

    const team1Leader = session.teams.team1.leader
    const team2Leader = session.teams.team2.leader

    if (teamName == null &&
      (
        (team1Leader != null && message.member.id !== team1Leader.id) &&
        (team2Leader != null && message.member.id !== team2Leader.id)
      )
    ) {
      message.channel.send('Can\'t add players to team, you are not the team leader')
      return
    }

    if (team1Leader == null || team2Leader == null) {
      message.channel.send('Both team leaders need to be set before picking')
      return
    }

    const targetMember = utils.resolveMember(message.guild, mention)

    if (targetMember == null) {
      message.channel.send(constants.MSG_INVALID_TARGET_MEMBER)
      return
    }

    const leaderTeamName = message.member.id === team1Leader.id ? 'team1' : 'team2'
    const enemyTeamName = leaderTeamName === 'team1' ? 'team2' : 'team1'

    if (teamName != null) {
      // Forcefully pick user
      const adminGranted = await permissions.checkPermission(message, constants.PERM_ADMIN)
      if (adminGranted) {
        if (constants.TEAM_NAMES[teamName] == null) {
          message.channel.send(constants.MSG_INVALID_TEAM_NAME)
          return
        }
        try {
          await session.addToTeam(teamName, targetMember)
          message.channel.send(
            `${targetMember} was added to ${constants.TEAM_NAMES[teamName]}\n` +
            `It's ${session.teams[session.getTurn()].leader}'s turn to pick`
          )
        } catch (err) {
          if (err instanceof errors.DuplicatePlayerError) {
            message.channel.send(`${targetMember} is already on a team`)
            return
          }

          console.log('pick player ERROR', err)
          message.channel.send('An error occured while trying to add a user to a team')
        }
      } else {
        message.channel.send('You don\'t have permission to force team picks')
      }
    } else {
      // Pick user as team leader
      const turnTeamName = session.getTurn()
      if (turnTeamName !== leaderTeamName) {
        message.channel.send(`It's currently ${session.teams[turnTeamName].leader}'s turn to pick`)
        return
      }

      try {
        await session.addToTeam(leaderTeamName, targetMember)
        session.setLastTurn(leaderTeamName)

        let msg = `${targetMember} was added to ${constants.TEAM_NAMES[leaderTeamName]}\n`
        if (session.getTurn() === turnTeamName) {
          msg += `It's still ${session.teams[leaderTeamName].leader}'s turn to pick`
        } else {
          msg += `It's ${session.teams[enemyTeamName].leader}'s turn to pick`
        }

        message.channel.send(msg)
      } catch (err) {
        if (err instanceof errors.DuplicatePlayerError) {
          message.channel.send(`${targetMember} is already on a team`)
          return
        }

        console.log('force pick player ERROR', err)
        message.channel.send('An error occured while trying to add a user to a team')
      }
    }
  })

  register('teams', {
    desc: 'Displays the teams and their members'
  }, async (bot, message, args) => {
    const registered = await guildSettings.isCommandChannelRegistered(message.guild.id, message.channel.id)
    if (!registered) {
      message.channel.send(constants.MSG_CMD_CHANNEL_NOT_REGISTERED)
      return
    }

    const session = gameSessions.getGameSession(message.guild, message.channel)
    if (!session.initialized) {
      message.channel.send(MSG_NO_GAME_SESSION)
      return
    }

    displayTeams({ session }, message.channel)
  })

  register('start', {
    desc: 'Starts the game session',
    perm: `Requires \`${constants.PERM_SETUP}\` or \`${constants.PERM_ADMIN}\``
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_SETUP).or(constants.PERM_ADMIN)

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

      const session = gameSessions.getGameSession(message.guild, message.channel)

      if (!session.initialized) {
        message.channel.send(MSG_NO_GAME_SESSION)
        return
      }

      if (session.started) {
        message.channel.send('Game session already started, use the `end` command to stop')
        return
      }

      try {
        await session.start()

        displayTeams({ session }, message.channel, 'Game session started!\n')
      } catch (err) {
        console.log('start game session ERROR', err)

        if (err instanceof errors.ChannelConfigurationError) {
          message.channel.send(`Invalid configuration; the \`${err.channel}\` channel isn't set`)
          return
        }

        if (err instanceof errors.MissingMovePermissionError) {
          message.channel.send('An error occured while trying to move users to the voice channels; does the bot have voice channel permissions?')
          return
        }

        message.channel.send('An error occured while trying to start the game session')
      }
    } else {
      message.channel.send('You don\'t have permission to start the game session')
    }
  })

  register('end', {
    desc: 'Terminates the game session',
    perm: `Requires \`${constants.PERM_SETUP}\` or \`${constants.PERM_ADMIN}\``
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_SETUP).or(constants.PERM_ADMIN)
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

      const session = gameSessions.getGameSession(message.guild, message.channel)

      if (!session.initialized) {
        message.channel.send(MSG_NO_GAME_SESSION)
        return
      }

      try {
        await session.end()
        message.channel.send('The game session has been terminated')
      } catch (err) {
        console.log('end game session ERROR', err)

        if (err instanceof errors.ChannelConfigurationError) {
          message.channel.send(`Invalid configuration; the \`${err.channel}\` channel isn't set`)
          return
        }

        if (err instanceof errors.MissingMovePermissionError) {
          message.channel.send('An error occured while trying to move users to the lobby voice channel; does the bot have voice channel permissions?')
          return
        }

        message.channel.send('An error occured while trying to terminate the game session')
      }
    } else {
      message.channel.send('You don\'t have permission to terminate the game session')
    }
  })

  register('setup', {
    desc: 'Initializes (or resets) the game session',
    perm: `Requires \`${constants.PERM_SETUP}\` or \`${constants.PERM_ADMIN}\``
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_SETUP).or(constants.PERM_ADMIN)
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

      const session = gameSessions.getGameSession(message.guild, message.channel)

      if (session.started) {
        message.channel.send('Game session already started, use the `end` command to stop')
        return
      }

      try {
        await session.setup()
        let msg = 'Game session initialized!'

        if (session.gameRules.isEnabled('randomLeaders')) {
          msg += `\n${session.teams.team1.leader} was randomly chosen as leader for ${constants.TEAM_NAMES.team1}`
               + `\n${session.teams.team2.leader} was randomly chosen as leader for ${constants.TEAM_NAMES.team2}`
               + `\n\n${session.teams[session.getTurn()].leader} gets to pick first`
        }

        message.channel.send(msg)
      } catch (err) {
        if (err instanceof errors.NotEnoughPlayersError) {
          message.channel.send(err.errMsg)
          return
        }

        if (err instanceof errors.ChannelConfigurationError) {
          message.channel.send(`Invalid configuration; the \`${err.channel}\` channel isn't set`)
          return
        }

        console.log('setup game ERROR', err)
        message.channel.send('An error occured while trying to setup the game session')
      }
    } else {
      message.channel.send('You don\'t have permission to setup a game session')
    }
  })
}
