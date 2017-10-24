import * as constants from '~/constants'
import * as errors from '~/errors'
import * as utils from '~/utils'
import gameRules from '~/gameRules'
import GameSession from '~/GameSession'
import { RichEmbed } from 'discord.js'

const MSG_NO_GAME_SESSION = 'No on-going game session, type `!setup` to initialize the game session'

// Map<ServerId, Map<TextChannelId, GameSession>>
const serverSessions = new Map()

function getGameSession(env, guild, channel) {
  let sessions = serverSessions.get(guild.id)
  if (sessions == null) {
    sessions = new Map()
    serverSessions.set(guild.id, sessions)
  }

  let session = sessions.get(channel.id)
  if (session == null) {
    session = new (GameSession(env))(guild, channel)
    sessions.set(channel.id, session)
  }

  return session
}

function displayTeams(env, channel) {
  const formatUserEntry = (member) => {
    const entry = `**${member.displayName}**`
    return utils.sanitizeCode(entry)
  }

  const getMemberList = (teamName) => {
    return formatUserEntry(env.session.teams[teamName].leader) + '\u{1F451}\n'
      + [...env.session.teams[teamName].members.values()].map(formatUserEntry).join('\n')
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

  channel.send({embed})
}

export default function load(api) {
  const { registerCommand: register, permissions, guildSettings } = api

  permissions.registerPermission(constants.PERM_ADMIN, 'Allows administrating game sessions')
  permissions.registerPermission(constants.PERM_SETUP, 'Allows setting up game sessions')
  permissions.registerPermission(constants.PERM_SETLEADER, 'Allows setting team leaders')

  register('gamerule', {
    desc: 'Manages game rules',
    perm: `Requires \`${constants.PERM_GAMERULE}\` or \`${constants.PERM_ADMIN}\``
  }, (bot, message, args) => {
    permissions.checkPermission(message, constants.PERM_GAMERULE).or(constants.PERM_ADMIN)
      .then((granted) => {
        if (granted) {

        } else {
          message.channel.send('You don\'t have permission to change the game rules')
        }
      })
  })

  register('setleader', {
    desc: 'Sets the team leader for a specified team',
    perm: `Requires \`${constants.PERM_SETLEADER}\` or \`${constants.PERM_ADMIN}\``,
    extra: '**setleader** <flake_id> team1|team2'
  }, (bot, message, args) => {
    const mention = args[0]
    const teamName = args[1]
    const session = getGameSession({bot, api}, message.guild, message.channel)

    permissions.checkPermission(message, constants.PERM_SETLEADER).or(constants.PERM_ADMIN)
      .then((granted) => {

        if (!session.initialized) {
          message.channel.send(MSG_NO_GAME_SESSION)
          return
        }

        if (constants.TEAM_NAMES[teamName] == null) {
          message.channel.send(constants.MSG_INVALID_TEAM_NAME)
          return
        }

        const targetMember = utils.resolveMember(message.guild, mention)

        if (targetMember == null) {
          message.channel.send(constants.MESSAGE_INVALID_TARGET_MEMBER)
          return
        }

        session.teams[teamName].leader = targetMember

        message.channel.send(`${targetMember} has been set as the team leader for ${constants.TEAM_NAMES[teamName]}`)

      })
  })

  register('unpick', {
    desc: 'Removes the target user from the team',
    perm: `Only works if used by a team leader. Team picks can be forced with the \`${constants.PERM_ADMIN}\` permission`,
    extra: '**unpick** <flake_id>'
  }, (bot, message, args) => {
    const mention = args[0]
    const teamName = args[1]
    const session = getGameSession({bot, api}, message.guild, message.channel)

    permissions.checkPermission(message, constants.PERM_ADMIN)
      .then((adminGranted) => {

        if (!session.initialized) {
          message.channe.send(MSG_NO_GAME_SESSION)
          return
        }

        const team1Leader = session.teams.team1.leader || {}
        const team2Leader = session.teams.team2.leader || {}

        const targetMember = utils.resolveMember(message.guild, mention)

        if (targetMember == null) {
          message.channel.send(constants.MESSAGE_INVALID_TARGET_MEMBER)
          return
        }

        if (!adminGranted &&
          (
            targetTeam === 'team1' && message.member.id !== team1Leader.id ||
            targetTeam === 'team2' && message.member.id !== team2Leader.id
          )
        ) {
          message.channel.send(`Can't remove ${targetMember} from the team, as you are not the team leader`)
          return
        }

        if (team1Leader.id === targetMember.id || team2Leader.id === targetMember.id) {
          message.channel.send('You can\'t unpick a team leader')
          return
        }

        let targetTeam
        if (session.teams.team1.members.has(targetMember.id)) {
          targetTeam = 'team1'
        } else if (session.teams.team2.members.has(targetMember.id)) {
          targetTeam = 'team2'
        } else {
          message.channel.send(`${targetMember} is not on a team`)
          return
        }

        session.removeFromTeam(targetTeam, targetMember)
          .then(() => {
            const msg = `${targetMember} was removed from ${constants.TEAM_NAMES[targetTeam]}\n`
                      + `It's ${session.teams[session.getTurn()].leader}'s turn to pick`

            message.channel.send(msg)
          }, (err) => {
            if (err instanceof errors.InvalidTeamMemberError) {
              message.channel.send(`${targetMember} is not on a team`)
              return
            }

            console.log('unpick player ERROR', err)
            message.channel.send('An error occured while trying to remove a user from a team')
          })

      })
  })

  register('pick', {
    desc: 'Adds the target user to the team',
    perm: `Only works if used by a team leader. Team picks can be forced with the \`${constants.PERM_ADMIN}\` permission`,
    extra: '**pick** <flake_id> [team1|team2]'
  }, (bot, message, args) => {
    const mention = args[0]
    const teamName = args[1]
    const session = getGameSession({bot, api}, message.guild, message.channel)

    permissions.checkPermission(message, constants.PERM_ADMIN)
      .then((adminGranted) => {

        if (!session.initialized) {
          message.channel.send(MSG_NO_GAME_SESSION)
          return
        }

        const team1Leader = session.teams.team1.leader || {}
        const team2Leader = session.teams.team2.leader || {}

        if (teamName == null &&
            message.member.id !== team1Leader.id &&
            message.member.id !== team2Leader.id
        ) {
          message.channel.send('Can\'t add players to team, you are not the team leader')
          return
        }

        const targetMember = utils.resolveMember(message.guild, mention)

        if (targetMember == null) {
          message.channel.send(constants.MESSAGE_INVALID_TARGET_MEMBER)
          return
        }

        const leaderTeamName = message.member.id === team1Leader.id ? 'team1' : 'team2'
        const enemyTeamName = leaderTeamName === 'team1' ? 'team2' : 'team1'

        if (teamName != null) {
          // Forcefully pick user

          if (adminGranted) {
            if (constants.TEAM_NAMES[teamName] == null) {
              message.channel.send(constants.MSG_INVALID_TEAM_NAME)
              return
            }

            session.addToTeam(teamName, targetMember)
              .then(() => {
                message.channel.send(`${targetMember} was added to ${constants.TEAM_NAMES[teamName]}`)
              }, (err) => {
                if (err instanceof errors.DuplicatePlayerError) {
                  message.channel.send(`${targetMember} is already on a team`)
                  return
                }

                console.log('pick player ERROR', err)
                message.channel.send('An error occured while trying to add a user to a team')
              })

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

          session.addToTeam(leaderTeamName, targetMember)
            .then(() => {
              session.setLastTurn(leaderTeamName)

              let msg = `${targetMember} was added to ${constants.TEAM_NAMES[leaderTeamName]}\n`
              if (session.getTurn() === turnTeamName) {
                msg += `It's still ${session.teams[leaderTeamName].leader}'s turn to pick`
              } else {
                msg += `It's now ${session.teams[enemyTeamName].leader}'s turn to pick`
              }

              message.channel.send(msg)
            }, (err) => {
              if (err instanceof errors.DuplicatePlayerError) {
                message.channel.send(`${targetMember} is already on a team`)
                return
              }

              console.log('force pick player ERROR', err)
              message.channel.send('An error occured while trying to add a user to a team')
            })
        }
      })
  })

  register('teams', {
    desc: 'Displays the teams and their members'
  }, (bot, message, args) => {

    guildSettings.isCommandChannelRegistered(message.guild.id, message.channel.id)
      .then((registered) => {

        if (!registered) {
          message.channel.send(constants.MSG_CMD_CHANNEL_NOT_REGISTERED)
          return
        }

        const session = getGameSession({bot, api}, message.guild, message.channel)
        if (!session.initialized) {
          message.channel.send(MSG_NO_GAME_SESSION)
          return
        }

        displayTeams({session}, message.channel)

      })
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
      }

      const session = getGameSession({bot, api}, message.guild, message.channel)

      if (!session.initialized) {
        message.channel.send(MSG_NO_GAME_SESSION)
        return
      }

      if (session.started) {
        message.channel.send('Game session already started, type `!end` to stop')
        return
      }

      try {
        await session.start()

        displayTeams({session}, message.channel)

        message.channel.send('Game session started!')
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
      message.channel.send('You don\'t have permission to start the 6v6 session')
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
      }

      const session = getGameSession({bot, api}, message.guild, message.channel)

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
  }, (bot, message, args) => {
    permissions.checkPermission(message, constants.PERM_SETUP).or(constants.PERM_ADMIN)
      .then((granted) => {
        if (granted) {

          guildSettings.isCommandChannelRegistered(message.guild.id, message.channel.id)
            .then((registered) => {

              if (!registered) {
                message.channel.send(constants.MSG_CMD_CHANNEL_NOT_REGISTERED)
                return
              }

              const session = getGameSession({bot, api}, message.guild, message.channel)

              if (session.started) {
                message.channel.send('Game session already started, type `!end` to stop')
                return
              }

              session.setup()
                .then(() => {
                  let msg = 'Game session initialized!'

                  if (session.gameRules.isEnabled('randomLeaders')) {
                    msg += `\n${session.teams.team1.leader} was randomly chosen as leader for ${constants.TEAM_NAMES.team1}`
                         + `\n${session.teams.team2.leader} was randomly chosen as leader for ${constants.TEAM_NAMES.team2}`
                         + `\n\n${session.teams[session.getTurn()].leader} gets to pick first`
                  }

                  message.channel.send(msg)
                }, (err) => {
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
                })
            }, (err) => {
              message.channel.send(constants.MSG_ERR_LOOKUP_CMDCHANNEL)
            })

        } else {
          message.channel.send('You don\'t have permission to setup a game session')
        }
      })
  })
}
