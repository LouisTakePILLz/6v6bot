import * as constants from '~/constants'
import * as errors from '~/errors'
import * as utils from '~/utils'
import GameRuleManager from '~/GameRuleManager'

const GameSession = (env) => class GameSession {
  constructor(guild, cmdChannel) {
    this.guild = guild
    this.cmdChannel = cmdChannel
    this.initialized = false
    this.started = false
    this.gameRules = new (GameRuleManager(env))()
    this._resetTeams()
  }

  _resetTeams() {
    // Maps preserve insertion order
    this.teams = {
      team1: {members: new Map()},
      team2: {members: new Map()}
    }
  }

  _pickRandomTeamLeader(teamName, members) {
    if (teamName !== 'team1' && teamName !== 'team2') {
      throw new errors.InvalidTeamNameError(teamName)
    }

    const enemyTeam = teamName === 'team1' ? 'team2' : 'team1'
    const enemyLeader = this.teams[enemyTeam].leader

    if (enemyLeader != null) {
      const enemyLeaderIndex = members.findIndex(x => x.id === enemyLeader.id)
      if (enemyLeaderIndex != null) {
        members.splice(enemyLeaderIndex, 1)
      }
    }

    if (members.length === 0) {
      throw new errors.NotEnoughPlayersError(constants.MSG_NOT_ENOUGH_PLAYERS_RANDOM_LEADER)
    }

    const randomMember = members[Math.floor(Math.random() * members.length)]

    this.teams[teamName].leader = randomMember

    return randomMember
  }

  removeFromTeam(teamName, member) {
    return new Promise((resolve, reject) => {
      if (teamName !== 'team1' && teamName !== 'team2') {
        reject(new errors.InvalidTeamNameError(teamName))
        return
      }

      if (teamName === 'team1' && !this.teams.team1.members.has(member.id) ||
          teamName === 'team2' && !this.teams.team2.members.has(member.id)
      ) {
        throw new errors.DuplicatePlayerError('The target member is not on the team')
      }

      this.teams[teamName].members.delete(member.id)

      resolve()
    })
  }

  addToTeam(teamName, member) {
    return new Promise((resolve, reject) => {
      if (teamName !== 'team1' && teamName !== 'team2') {
        reject(new errors.InvalidTeamNameError(teamName))
        return
      }

      if (member.id === this.teams.team1.leader.id ||
        member.id === this.teams.team2.leader.id ||
        this.teams.team1.members.has(member.id) ||
        this.teams.team2.members.has(member.id)
      ) {
        throw new errors.DuplicatePlayerError('The target member is already on a team')
      }

      this.teams[teamName].members.set(member.id, member)

      console.log(this.teams[teamName].members.keys())

      resolve()
    })
  }

  getTurn() {
    const team1Members = this.teams.team1.members
    const team2Members = this.teams.team2.members
    const delta = team1Members.size - team2Members.size

    if (delta >= 1) {
      return 'team2'
    } else if (delta <= -1) {
      return 'team1'
    } else {
      return this.lastTurn === 'team1' ? 'team2' : 'team1'
    }
  }

  setLastTurn(teamName) {
    this.lastTurn = teamName
  }

  async moveMembersToChannels() {
    const lobbyVoiceChannel = utils.resolveVoiceChannel(
      this.guild,
      await env.guildSettings.getVoiceChannelId(this.guild.id, this.cmdChannel.id, 'lobby')
    )
    const team1VoiceChannel = utils.resolveVoiceChannel(
      this.guild,
      await env.guildSettings.getVoiceChannelId(this.guild.id, this.cmdChannel.id, 'team1')
    )
    const team2VoiceChannel = utils.resolveVoiceChannel(
      this.guild,
      await env.guildSettings.getVoiceChannelId(this.guild.id, this.cmdChannel.id, 'team2')
    )

    const forceVoice = this.gameRules.isEnabled('forceVoice')

    const moveToVoiceChannel = async (member, voiceChannel) => {
      if (forceVoice || member.voiceChannelID === lobbyVoiceChannel.id) {
      }
        await member.setVoiceChannel(voiceChannel)
      }

    // Move Team 1

    if (this.teams.team1.leader != null) {
      await moveToVoiceChannel(this.teams.team1.leader, team1VoiceChannel)
    }

    for (const [,member] of this.teams.team1.members) {
      await moveToVoiceChannel(member, team1VoiceChannel)
    }

    // Move Team 2

    if (this.teams.team2.leader != null) {
      await moveToVoiceChannel(this.teams.team2.leader, team2VoiceChannel)
    }

    for (const [,member] of this.teams.team2.members) {
      await moveToVoiceChannel(member, team2VoiceChannel)
    }
  }

  async moveMembersToLobby() {
    const lobbyVoiceChannel = utils.resolveVoiceChannel(
      this.guild,
      await env.guildSettings.getVoiceChannelId(this.guild.id, this.cmdChannel.id, 'lobby')
    )

    if (this.teams.team1.leader != null) {
      await this.teams.team1.leader.setVoiceChannel(lobbyVoiceChannel)
    }

    for (const [,member] of this.teams.team1.members) {
      await member.setVoiceChannel(lobbyVoiceChannel)
    }

    // Move Team 2

    if (this.teams.team2.leader != null) {
      await this.teams.team2.leader.setVoiceChannel(lobbyVoiceChannel)
    }

    for (const [,member] of this.teams.team2.members) {
      await member.setVoiceChannel(lobbyVoiceChannel)
    }
  }

  async setup(shouldReset = true) {
    const lobbyVoiceChannel = utils.resolveVoiceChannel(
      this.guild,
      await env.guildSettings.getVoiceChannelId(this.guild.id, this.cmdChannel.id, 'lobby')
    )

    if (shouldReset) {
      this._resetTeams()
    }

    if (this.gameRules.isEnabled('randomLeaders')) {
      const memberPool = [...lobbyVoiceChannel.members.values()]
      this._pickRandomTeamLeader('team1', memberPool)
      this._pickRandomTeamLeader('team2', memberPool)
    }

    this.initialized = true
  }

  async start() {
    try {
      await this.moveMembersToChannels()

      this.started = true
    } catch (err) {
      if (err instanceof errors.DiscordAPIError && err.code === 50013) {
        throw new errors.MissingMovePermissionError()
      }

      throw err
    }
  }

  async end() {
    try {
      await this.moveMembersToLobby()
      this._resetTeams()

      this.started = false
    } catch (err) {
      if (err instanceof errors.DiscordAPIError && err.code === 50013) {
        throw new errors.MissingMovePermissionError()
      }

      throw err
    }
  }
}

export default GameSession
