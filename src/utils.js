export function sanitizeCode(input) {
  if (typeof input !== 'string') {
    return
  }

  return input.replace(/`/g, '\'')
}

export function isPositiveInteger(input) {
  return /^\+?(0|[1-9]\d*)$/.test(input)
}

export function getUserVoiceChannel(bot, guild, user) {
  return guild.channels.find((channel) => {
    if (channel.members.find((member) => member.id === user.id) != null) {
      return true
    }

    return false
  })
}
