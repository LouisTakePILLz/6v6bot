import * as constants from '~/constants'
import * as errors from '~/errors'
import GameRuleManager from '~/GameRuleManager'

const GameSession = (env) => class GameSession {
  constructor(guild, cmdChannel) {
    this.guild = guild
    this.cmdChannel = cmdChannel
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

  _getVoiceChannel(voiceChannelId) {
    const voiceChannel = this.guild.channels.get(voiceChannelId)
    if (voiceChannel == null || voiceChannel.type !== 'voice') {
      return null
    }

    return voiceChannel
  }

  _getLobbyVoiceChannel() {
    return new Promise((resolve, reject) => {
      env.api.guildSettings.getLobbyVoiceChannel(this.guild.id, this.cmdChannel.id)
        .then((lobbyVoiceChannelId) => {
          resolve(this._getVoiceChannel(lobbyVoiceChannelId))
        }, reject)
    })
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
      throw new errors.NotEnoughPlayersError('Not enough players available to pick the team leaders')
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

  // TODO: implement event system or return promises?

  start() {
    return new Promise((resolve, reject) => {
      this._getLobbyVoiceChannel()
        .then((lobbyVoiceChannel) => {
          if (lobbyVoiceChannel == null) {
            reject(new errors.ChannelConfigurationError('Missing lobby voice channel'))
            return
          }

          if (this.gameRules.isEnabled('randomLeaders')) {
            console.log('randomLeaders enabled')
            this._resetTeams()
            const memberPool = [...lobbyVoiceChannel.members.values()]
            this._pickRandomTeamLeader('team1', memberPool)
            this._pickRandomTeamLeader('team2', memberPool)
          }

          this.started = true
          resolve()
        }, (err) => {
          console.log('getLobbyVoiceChannel ERROR', err)
          reject(err)
        })
        .catch(reject)
    })
  }

  stop() {

  }
}

export default GameSession
