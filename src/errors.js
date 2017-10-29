export class GenericError extends Error {
  constructor(msg, ...params) {
    super(...params)

    this.errMsg = msg
  }
}

export class InvalidGameRuleError extends Error {
  constructor(value, ...params) {
    super(...params)

    this.ruleName = value
  }
}

export class InvalidGameRuleValueError extends Error {
  constructor(type, value, ...params) {
    super(...params)

    this.ruleType = type
    this.ruleValue = value
  }
}

export class GameruleValidationError extends GenericError {}

// Used for reporting missing channels...
export class ChannelConfigurationError extends GenericError {
  constructor(value, ...params) {
    super(...params)

    this.channel = value
  }
}

export class CommandChannelNotRegisteredError extends Error {}

export class InvalidTeamNameError extends Error {
  constructor(teamName, ...params) {
    super(...params)

    this.teamName = teamName
  }
}

export class TeamFullError extends GenericError {}

export class DuplicatePlayerError extends GenericError {}

export class NotEnoughPlayersError extends GenericError {}

export class MissingMovePermissionError extends GenericError {}

export class DbError extends Error {}

export { DiscordAPIError } from 'discord.js'
