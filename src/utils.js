export function sanitizeCode(input) {
  if (typeof input !== 'string') {
    return null
  }

  return input.replace(/`/g, '\'')
}

export function isNullOrWhitespace(input) {
  return !input || !input.trim()
}

export function isPositiveInteger(input) {
  return /^\+?(0|[1-9]\d*)$/.test(input)
}

export function stringToBoolean(input) {
  if (input.equalsIgnoreCase('true') || input === '1') {
    return true
  }

  if (input.equalsIgnoreCase('false') || input === '0') {
    return false
  }

  return null
}

export function resolveVoiceChannel(guild, voiceChannelId) {
  if (voiceChannelId == null) {
    return null
  }

  const voiceChannel = guild.channels.get(voiceChannelId)
  if (voiceChannel == null || voiceChannel.type !== 'voice') {
    return null
  }

  return voiceChannel
}

export function getUserVoiceChannel(bot, guild, user) {
  return guild.channels.find((channel) => {
    if (channel.type === 'voice' && channel.members.find(x => x.id === user.id) != null) {
      return true
    }

    return false
  })
}

export function extractMentionId(mention) {
  const mentionPattern = /<@!?(\d+)>/g
  const matches = mentionPattern.exec(mention)
  if (matches == null) {
    return null
  }
  const [, memberId] = matches
  return memberId
}

export function resolveMember(guild, mention) {
  return guild.members.get(extractMentionId(mention) || mention)
}
