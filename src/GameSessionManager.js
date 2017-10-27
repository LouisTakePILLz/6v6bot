import GameSession from '~/GameSession'

const GameSessionManagerWrapper = env => class GameSessionManager {
  constructor() {
    // Map<GuildId, Map<TextChannelId, GameSession>>
    this.serverSessions = new Map()
  }

  getGameSession(guild, channel) {
    const sessions = this.getGameSessions(guild)

    let session = sessions.get(channel.id)
    if (session == null) {
      session = new (GameSession(env))(guild, channel)
      sessions.set(channel.id, session)
    }

    return session
  }

  getGameSessions(guild) {
    let sessions = this.serverSessions.get(guild.id)
    if (sessions == null) {
      sessions = new Map()
      this.serverSessions.set(guild.id, sessions)
    }

    return sessions
  }

  /*getGameSessionByLobby(voiceChannel) {
    const sessions = this.getGameSessions(voiceChannel.guild)
    // TODO: env.guildSettings.getCommandChannelByChannelSetting(voiceChannel.guild.id, 'lobby', voiceChannel.id)
  }*/
}

export default GameSessionManagerWrapper
