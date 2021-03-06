import { RichEmbed } from 'discord.js'
import * as constants from '~/constants'
import * as errors from '~/errors'
import * as utils from '~/utils'
import { gameRules, gameRuleValueTypes } from '~/gameRules'

const GAMERULES_PER_PAGE = 5

const MSG_NO_GAME_SESSION = 'No on-going game session, use the `setup` command to initialize the game session'
const MSG_GAME_SESSION_STARTED = 'Game session started!'

async function showGameRule({ session }, message, ruleName) {
  const rule = await session.gameRules.getRule(ruleName)

  const embed = new RichEmbed()
    .setTitle(`6v6 - Game Rule: ${utils.sanitizeCode(rule.ruleName)}`)
    .setColor(constants.EMBED_COLOR)
    .setTimestamp()
    .setDescription('__**Description**__\n' + rule.helpText)
    .addField('**Enabled**', '`' + (rule.enabled || false) + '`', false)

  let defaults = `Enabled: \`${rule.defaultEnabled || false}\``

  const value = rule.value == null ? rule.defaultValue : rule.value

  if (rule.type !== gameRuleValueTypes.boolean) {
    embed.addField('**Value**', '`' + utils.sanitizeCode(value == null ? 'null' : value) + '`', false)
    defaults += `\nValue: \`${rule.defaultValue || 'null'}\``
  }

  embed.addField('**Defaults**', defaults, false)

  message.channel.send({ embed })
}

function displayTeams(env, channel, textMessage) {
  const formatUserEntry = ({ member, hero }) => {
    let entry = `**${member.displayName}**`

    if (hero != null) {
      entry += ` - ${constants.OW_HERO_NAMES[hero]}`
    }

    return utils.sanitizeCode(entry)
  }

  const getMemberList = (teamName) => {
    let list = '*Empty*'
    if (env.session.teams[teamName].leader.member != null) {
      list = formatUserEntry(env.session.teams[teamName].leader) + ' \u{1F451}'
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
    .setColor(constants.EMBED_COLOR)
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
  permissions.registerPermission(constants.PERM_SETUP, 'Allows setting up and terminating game sessions')
  permissions.registerPermission(constants.PERM_GAMERULE, 'Allows configuring the game rules')
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
        const gameRulesKeys = Object.keys(gameRules)

        const embed = new RichEmbed()
          .setTitle('6v6 - Game Rules')
          .setColor(constants.EMBED_COLOR)
          .setTimestamp()

        const maxPage = Math.ceil(Math.max(gameRulesKeys.length / GAMERULES_PER_PAGE, 1))
        const page = Math.max(Math.min(Number(args[1]) || 1, maxPage), 1)

        embed.setFooter(`Page ${page} of ${maxPage}`, 'https://cdn.discordapp.com/embed/avatars/0.png')

        const lastGameRule = Math.min(page * GAMERULES_PER_PAGE, gameRulesKeys.length)
        for (let i = (page - 1) * GAMERULES_PER_PAGE; i < lastGameRule; i++) {
          const gameRuleName = gameRulesKeys[i]
          const gameRule = gameRules[gameRuleName]
          embed.addField('`' + gameRule.ruleName + '`', gameRule.helpText, false)
        }

        message.channel.send({ embed })
        return
      }

      if (session.initialized) {
        message.channel.send('Unable to change game rules during setup or during an on-going game session')
        return
      }

      if (action === 'set') {
        const ruleName = args[1]
        const value = args[2]

        try {
          await session.gameRules.setRule(ruleName, value)
          await showGameRule({ session }, message, ruleName)
        } catch (err) {
          if (err instanceof errors.InvalidGameRuleError) {
            message.channel.send(`Invalid gamerule \`${utils.sanitizeCode(err.ruleName)}\``)
            return
          }

          if (err instanceof errors.InvalidGameRuleValueError) {
            if (err.ruleType === gameRuleValueTypes.boolean) {
              message.channel.send(`Invalid value \`${utils.sanitizeCode(err.ruleValue)}\`, possible values: \`true\`, \`false\``)
              return
            }

            message.channel.send(`Invalid value \`${utils.sanitizeCode(err.ruleValue)}\``)
            return
          }

          if (err instanceof errors.GameruleValidationError) {
            message.channel.send(`Validation error: ${err.errMsg}`)
            return
          }

          console.log('gamerule set ERROR', err)
          message.channel.send('An error occured while trying to set the value for a gamerule')
        }
      } else if (action === 'enable') {
        const ruleName = args[1]
        try {
          await session.gameRules.setRule(ruleName, true)
          await showGameRule({ session }, message, ruleName)
        } catch (err) {
          if (err instanceof errors.InvalidGameRuleError) {
            message.channel.send(`Invalid gamerule \`${utils.sanitizeCode(err.ruleName)}\``)
            return
          }

          console.log('gamerule enable ERROR', err)
          message.channel.send('An error occured while trying to enable a gamerule')
        }
      } else if (action === 'disable') {
        const ruleName = args[1]
        try {
          await session.gameRules.setRule(ruleName, false)
          await showGameRule({ session }, message, ruleName)
        } catch (err) {
          if (err instanceof errors.InvalidGameRuleError) {
            message.channel.send(`Invalid gamerule \`${utils.sanitizeCode(err.ruleName)}\``)
            return
          }

          console.log('gamerule disable ERROR', err)
          message.channel.send('An error occured while trying to disable a gamerule')
        }
      } else if (action === 'show') {
        const ruleName = args[1]
        try {
          await showGameRule({ session }, message, ruleName)
        } catch (err) {
          if (err instanceof errors.InvalidGameRuleError) {
            message.channel.send(`Invalid gamerule \`${utils.sanitizeCode(err.ruleName)}\``)
            return
          }

          console.log('gamerule show ERROR', err)
          message.channel.send('An error occured while trying to display a gamerule')
        }
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

      const teamLeader = session.teams[teamName].leader
      const enemyTeam = teamName === 'team1' ? 'team2' : 'team1'
      const enemyLeader = session.teams[enemyTeam].leader

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

        // Remove the current team leader from the pool
        if (teamLeader.member != null) {
          const teamLeaderIndex = memberPool.findIndex(x => x.id === teamLeader.member.id)
          if (~teamLeaderIndex) {
            memberPool.splice(teamLeaderIndex, 1)
          }
        }

        // Remove the enemy team leader from the pool
        if (enemyLeader.member != null) {
          const enemyLeaderIndex = memberPool.findIndex(x => x.id === enemyLeader.member.id)
          if (~enemyLeaderIndex) {
            memberPool.splice(enemyLeaderIndex, 1)
          }
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

        if (enemyLeader.member != null && targetMember.id === enemyLeader.member.id) {
          message.channel.send('You can\'t set the same team leader for both teams')
          return
        }

        if (targetMember == null) {
          message.channel.send(constants.MSG_INVALID_TARGET_MEMBER)
          return
        }
      }

      if (constants.TEAM_NAMES[teamName] == null) {
        message.channel.send(constants.MSG_INVALID_TEAM_NAME)
        return
      }

      session.teams[teamName].leader = { member: targetMember }

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

    const team1Leader = session.teams.team1.leader.member || {}
    const team2Leader = session.teams.team2.leader.member || {}

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
                + `It's ${session.teams[session.getTurn()].leader.member}'s turn to pick`

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

    const { member: team1Leader } = session.teams.team1.leader
    const { member: team2Leader } = session.teams.team2.leader

    if (teamName == null &&
      (
        (team1Leader != null && message.member.id !== team1Leader.id) &&
        (team2Leader != null && message.member.id !== team2Leader.id)
      )
    ) {
      message.channel.send('Can\'t add players to team, as you are not the team leader')
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

    const {
      value: maxMembers,
      enabled: maxMembersEnabled
    } = await session.gameRules.getRule('maxTeamMembers')
    const autoStart = await session.gameRules.isEnabled('autoStart')

    const leaderTeamName = message.member.id === team1Leader.id ? 'team1' : 'team2'
    const enemyTeamName = leaderTeamName === 'team1' ? 'team2' : 'team1'

    if (teamName != null) {
      // Forcefully pick user
      const adminGranted = await permissions.checkPermission(message, constants.PERM_ADMIN)
      if (!adminGranted) {
        message.channel.send('You don\'t have permission to force team picks')
        return
      }

      if (constants.TEAM_NAMES[teamName] == null) {
        message.channel.send(constants.MSG_INVALID_TEAM_NAME)
        return
      }

      if (maxMembersEnabled && session.teams[teamName].members.size >= maxMembers) {
        message.channel.send(`Cant pick; ${constants.TEAM_NAMES[teamName]} is full`)
        return
      }

      try {
        let msg = `${targetMember} was added to ${constants.TEAM_NAMES[teamName]}`

        await session.addToTeam(targetMember, teamName)

        if (session.started) {
          message.channel.send(msg)
          return
        }

        if (
          maxMembersEnabled &&
          session.teams.team1.members.size >= maxMembers &&
          session.teams.team2.members.size >= maxMembers
        ) {
          if (autoStart) {
            message.channel.send(msg)
            await session.start()
            displayTeams({ session }, message.channel, MSG_GAME_SESSION_STARTED)
            return
          }

          msg += '\nThe teams are now complete, use the `start` command to start the game session'
        } else {
          msg += `\nIt's ${session.teams[session.getTurn()].leader.member}'s turn to pick`
        }

        message.channel.send(msg)
      } catch (err) {
        if (err instanceof errors.DuplicatePlayerError) {
          message.channel.send(`${targetMember} is already on a team`)
          return
        }

        console.log('pick player ERROR', err)
        message.channel.send('An error occured while trying to add a user to a team')
      }
    } else {
      const turnTeamName = session.getTurn()
      if (turnTeamName !== leaderTeamName) {
        message.channel.send(`It's currently ${session.teams[turnTeamName].leader.member}'s turn to pick`)
        return
      }

      if (maxMembersEnabled && session.teams[leaderTeamName].members.size >= maxMembers) {
        message.channel.send('Cant pick; your team is full')
        return
      }

      try {
        let msg = `${targetMember} was added to ${constants.TEAM_NAMES[leaderTeamName]}`

        await session.addToTeam(targetMember, leaderTeamName)
        session.setLastTurn(leaderTeamName)

        if (session.started) {
          message.channel.send(msg)
          return
        }

        if (maxMembersEnabled &&
          session.teams.team1.members.size >= maxMembers &&
          session.teams.team2.members.size >= maxMembers
        ) {
          if (autoStart) {
            message.channel.send(msg)
            await session.start()
            displayTeams({ session }, message.channel, MSG_GAME_SESSION_STARTED)
            return
          }

          msg += '\nThe teams are now complete, use the `start` command to start the game session'
        } else {
          // eslint-disable-next-line no-lonely-if
          if (session.getTurn() === turnTeamName) {
            msg += `\nIt's still ${session.teams[leaderTeamName].leader.member}'s turn to pick`
          } else {
            msg += `\nIt's ${session.teams[enemyTeamName].leader.member}'s turn to pick`
          }
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

        displayTeams({ session }, message.channel, MSG_GAME_SESSION_STARTED + '\n')
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

        if (await session.gameRules.isEnabled('randomLeaders')) {
          msg += `\n${session.teams.team1.leader.member} was randomly chosen as leader for ${constants.TEAM_NAMES.team1}`
               + `\n${session.teams.team2.leader.member} was randomly chosen as leader for ${constants.TEAM_NAMES.team2}`
               + `\n\n${session.teams[session.getTurn()].leader.member} gets to pick first`
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
